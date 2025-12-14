from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid
from ..core.deps import get_current_user
from ..database.database import get_db
from ..database.models import Profile, N8NWorkflow, N8NExecution, UserWorkflowAccess
from app.services.n8n_sync import _load_instances

router = APIRouter()

@router.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    return {"message": f"Welcome {user['email']}", "workflows": []}

@router.get("/me")
async def me(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return current user profile. Prefer DB values; fall back to JWT claim for role."""
    try:
        user_id = uuid.UUID(user["id"])
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            return {"id": user.get("id"), "email": user.get("email"), "role": user.get("role", "user")}
        role = profile.role or user.get("role", "user")
        return {
            "id": str(profile.id),
            "email": profile.email,
            "role": role
        }
    except Exception:
        return {"id": user.get("id"), "email": user.get("email"), "role": user.get("role", "user")}

@router.get("/workflows")
async def list_workflows(user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        user_id = uuid.UUID(user["id"])
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        role = profile.role if profile else None
        
        if role == "superadmin":
            workflows = db.query(N8NWorkflow).order_by(desc(N8NWorkflow.updated_at)).all()
        else:
            # Get allowed workflow IDs for this user
            access_records = db.query(UserWorkflowAccess).filter(
                UserWorkflowAccess.user_id == user_id
            ).all()
            allowed_ids = [str(acc.workflow_id) for acc in access_records]
            if not allowed_ids:
                return []
            workflows = db.query(N8NWorkflow).filter(
                N8NWorkflow.id.in_(allowed_ids)
            ).order_by(desc(N8NWorkflow.updated_at)).all()
        
        return [
            {
                "id": wf.id,
                "name": wf.name,
                "active": wf.active,
                "updated_at": wf.updated_at.isoformat() if wf.updated_at else None
            }
            for wf in workflows
        ]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/executions")
async def list_executions(user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        user_id = uuid.UUID(user["id"])
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        role = profile.role if profile else None
        
        if role == "superadmin":
            executions = db.query(N8NExecution).order_by(desc(N8NExecution.started_at)).all()
        else:
            # Get allowed workflow IDs for this user
            access_records = db.query(UserWorkflowAccess).filter(
                UserWorkflowAccess.user_id == user_id
            ).all()
            allowed_ids = [str(acc.workflow_id) for acc in access_records]
            if not allowed_ids:
                return []
            executions = db.query(N8NExecution).filter(
                N8NExecution.workflow_id.in_(allowed_ids)
            ).order_by(desc(N8NExecution.started_at)).all()
        
        return [
            {
                "id": ex.id,
                "workflow_id": ex.workflow_id,
                "status": ex.status,
                "finished": ex.finished,
                "started_at": ex.started_at.isoformat() if ex.started_at else None,
                "stopped_at": ex.stopped_at.isoformat() if ex.stopped_at else None
            }
            for ex in executions
        ]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/instances")
async def list_instances(user=Depends(get_current_user)):
    try:
        insts = _load_instances()
        return [{"prefix": i["prefix"], "name": i["name"], "base_url": i.get("base_url")} for i in insts]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


