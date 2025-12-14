from datetime import datetime
from typing import Any, Dict, List, Set
from dateutil import parser as date_parser
import requests
from sqlalchemy.orm import Session
from sqlalchemy import and_
from ..core.config import N8N_URL, N8N_API_KEY, LOCAL_N8N_URL, LOCAL_N8N_API_KEY
from ..database.database import SessionLocal
from ..database.models import N8NWorkflow, N8NExecution, N8NInstance, UserWorkflowAccess

def n8n_headers(api_key: str):
    return {"X-N8N-API-KEY": api_key} if api_key else {}

def _normalize_workflows(payload: Any, id_prefix: str = "") -> List[Dict[str, Any]]:
    data = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(data, list):
        return []
    normalized: List[Dict[str, Any]] = []
    for wf in data:
        if not isinstance(wf, dict):
            continue
        raw_id = wf.get("id")
        normalized.append({
            "id": f"{id_prefix}{raw_id}" if id_prefix else str(raw_id),
            "name": wf.get("name"),
            "active": bool(wf.get("active", False)),
            "updated_at": datetime.utcnow()
        })
    return normalized

def _normalize_executions(payload: Any, id_prefix: str = "") -> List[Dict[str, Any]]:
    data = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(data, list):
        return []
    normalized: List[Dict[str, Any]] = []
    for ex in data:
        if not isinstance(ex, dict):
            continue
        ex_id = ex.get("id") or ex.get("executionId")
        wf_id = ex.get("workflowId") or ex.get("workflow_id")
        finished = bool(ex.get("finished", False))
        status = ex.get("status")
        if status is None:
            status = "finished" if finished else "running"
        started_at = ex.get("startedAt") or ex.get("started_at")
        stopped_at = ex.get("stoppedAt") or ex.get("stopped_at")
        
        # Parse datetime strings if they exist
        started_at_dt = None
        stopped_at_dt = None
        if started_at:
            try:
                started_at_dt = date_parser.parse(started_at) if isinstance(started_at, str) else started_at
            except:
                pass
        if stopped_at:
            try:
                stopped_at_dt = date_parser.parse(stopped_at) if isinstance(stopped_at, str) else stopped_at
            except:
                pass
        
        normalized.append({
            "id": (f"{id_prefix}{ex_id}" if id_prefix else str(ex_id)) if ex_id is not None else None,
            "workflow_id": (f"{id_prefix}{wf_id}" if id_prefix else str(wf_id)) if wf_id is not None else None,
            "status": status,
            "finished": finished,
            "started_at": started_at_dt,
            "stopped_at": stopped_at_dt,
        })
    return [row for row in normalized if row.get("id") is not None]

def _upsert_workflows(db: Session, workflows: List[Dict[str, Any]]):
    """Upsert workflows into database"""
    if not workflows:
        return
    for wf_data in workflows:
        workflow = db.query(N8NWorkflow).filter(N8NWorkflow.id == wf_data["id"]).first()
        if workflow:
            workflow.name = wf_data["name"]
            workflow.active = wf_data["active"]
            workflow.updated_at = wf_data["updated_at"]
        else:
            workflow = N8NWorkflow(**wf_data)
            db.add(workflow)
    db.commit()

def _upsert_executions(db: Session, executions: List[Dict[str, Any]]):
    """Upsert executions into database"""
    if not executions:
        return
    for ex_data in executions:
        execution = db.query(N8NExecution).filter(N8NExecution.id == ex_data["id"]).first()
        if execution:
            execution.workflow_id = ex_data["workflow_id"]
            execution.status = ex_data["status"]
            execution.finished = ex_data["finished"]
            execution.started_at = ex_data.get("started_at")
            execution.stopped_at = ex_data.get("stopped_at")
        else:
            execution = N8NExecution(**ex_data)
            db.add(execution)
    db.commit()

def _load_instances() -> List[Dict[str, Any]]:
    """Load n8n instances from environment and database"""
    instances: List[Dict[str, Any]] = []
    if N8N_URL:
        instances.append({"prefix": "env", "name": "Primary", "base_url": N8N_URL, "api_key": N8N_API_KEY})
    if LOCAL_N8N_URL:
        instances.append({"prefix": "local", "name": "Local", "base_url": LOCAL_N8N_URL, "api_key": LOCAL_N8N_API_KEY})
    
    # Load from database
    db = SessionLocal()
    try:
        db_instances = db.query(N8NInstance).filter(N8NInstance.active == True).all()
        for inst in db_instances:
            prefix = (inst.identifier or "").strip() if inst.identifier else f"inst_{inst.id}"
            prefix = prefix.replace(":", "-")  # avoid colon in prefix
            instances.append({
                "prefix": prefix,
                "name": inst.name or "instance",
                "base_url": inst.base_url,
                "api_key": inst.api_key or "",
            })
    except Exception:
        pass
    finally:
        db.close()
    
    # Deduplicate by prefix
    seen: Set[str] = set()
    unique: List[Dict[str, Any]] = []
    for inst in instances:
        if not inst.get("base_url") or inst["prefix"] in seen:
            continue
        seen.add(inst["prefix"])
        unique.append(inst)
    return unique

def sync_once() -> Dict[str, int]:
    """Sync workflows and executions from n8n instances to database"""
    workflows_count = 0
    executions_count = 0
    db = SessionLocal()
    
    try:
        # Sync workflows
        instances = _load_instances()
        all_workflows: List[Dict[str, Any]] = []
        for inst in instances:
            try:
                w = requests.get(f"{inst['base_url']}/workflows", headers=n8n_headers(inst["api_key"]), timeout=15)
                w.raise_for_status()
                all_workflows += _normalize_workflows(w.json(), id_prefix=f"{inst['prefix']}:")
            except Exception:
                continue
        
        _upsert_workflows(db, all_workflows)
        workflows_count = len(all_workflows)
        
        # Get workflow IDs from API and database
        api_workflow_ids: Set[str] = {str(w["id"]) for w in all_workflows if w.get("id") is not None}
        db_workflows = db.query(N8NWorkflow).all()
        db_workflow_ids: Set[str] = {str(wf.id) for wf in db_workflows}
        
        # Delete stale workflows and related data
        stale_workflow_ids = list(db_workflow_ids - api_workflow_ids)
        if stale_workflow_ids:
            try:
                # Delete executions for stale workflows
                db.query(N8NExecution).filter(N8NExecution.workflow_id.in_(stale_workflow_ids)).delete(synchronize_session=False)
                # Delete workflow access for stale workflows
                db.query(UserWorkflowAccess).filter(UserWorkflowAccess.workflow_id.in_(stale_workflow_ids)).delete(synchronize_session=False)
                # Delete stale workflows
                db.query(N8NWorkflow).filter(N8NWorkflow.id.in_(stale_workflow_ids)).delete(synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()
    except Exception:
        db.rollback()
    
    try:
        # Sync executions
        instances = _load_instances()
        all_execs: List[Dict[str, Any]] = []
        for inst in instances:
            try:
                e = requests.get(f"{inst['base_url']}/executions", headers=n8n_headers(inst["api_key"]), timeout=15)
                e.raise_for_status()
                all_execs += _normalize_executions(e.json(), id_prefix=f"{inst['prefix']}:")
            except Exception:
                continue
        
        _upsert_executions(db, all_execs)
        executions_count = len(all_execs)
        
        # Get execution IDs from API and database
        api_execution_ids: Set[str] = {str(e["id"]) for e in all_execs if e.get("id") is not None}
        db_executions = db.query(N8NExecution).all()
        db_execution_ids: Set[str] = {str(ex.id) for ex in db_executions}
        
        # Delete stale executions
        stale_execution_ids = list(db_execution_ids - api_execution_ids)
        if stale_execution_ids:
            try:
                db.query(N8NExecution).filter(N8NExecution.id.in_(stale_execution_ids)).delete(synchronize_session=False)
                db.commit()
            except Exception:
                db.rollback()
    except Exception:
        db.rollback()
    finally:
        db.close()
    
    return {"workflows": workflows_count, "executions": executions_count}


