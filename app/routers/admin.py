from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid
import secrets
import bcrypt
from datetime import datetime
from ..core.deps import require_superadmin
from ..database.database import get_db
from ..database.models import Profile, ActionLog, UserWorkflowAccess, N8NInstance

router = APIRouter(prefix="/admin")

@router.post("/users")
async def create_user(request: Request, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    """Create a new user with @khalti.com email. Role defaults to 'user'."""
    body = await request.json()
    email = (body.get("email") or "").strip()
    
    if not email:
        return JSONResponse({"error": "Email is required"}, status_code=400)
    
    if not email.endswith("@khalti.com"):
        return JSONResponse({"error": "Only @khalti.com email addresses are allowed"}, status_code=400)
    
    # Check if user already exists
    existing = db.query(Profile).filter(Profile.email == email).first()
    if existing:
        return JSONResponse({"error": "User with this email already exists"}, status_code=400)
    
    try:
        # Generate a random password hash (users will use Google OAuth)
        random_password = secrets.token_urlsafe(12)
        hashed = bcrypt.hashpw(random_password.encode(), bcrypt.gensalt()).decode()
        
        # Create new user with role 'user' by default
        user_id = uuid.uuid4()
        profile = Profile(
            id=user_id,
            email=email,
            role="user",  # Default role
            pass_hash=hashed
        )
        db.add(profile)
        
        # Log the action
        action_log = ActionLog(
            user_id=user_id,
            action=f"User created by superadmin: {email}",
            timestamp=datetime.utcnow()
        )
        db.add(action_log)
        
        db.commit()
        db.refresh(profile)
        
        return {
            "id": str(profile.id),
            "email": profile.email,
            "role": profile.role
        }
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/users")
async def list_users(_=Depends(require_superadmin), db: Session = Depends(get_db)):
    try:
        profiles = db.query(Profile).order_by(Profile.email).all()
        return [
            {
                "id": str(p.id),
                "email": p.email,
                "role": p.role
            }
            for p in profiles
        ]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/users/role")
async def set_role(request: Request, current_user=Depends(require_superadmin), db: Session = Depends(get_db)):
    body = await request.json()
    user_id_str = body.get("user_id")
    role = body.get("role")
    if role not in ("user", "superadmin"):
        return JSONResponse({"error": "Invalid role"}, status_code=400)
    try:
        user_id = uuid.UUID(user_id_str)
        current_user_id = uuid.UUID(current_user["id"])
        
        # Prevent superadmins from downgrading themselves
        if current_user_id == user_id and role == "user":
            return JSONResponse({"error": "You cannot downgrade yourself from superadmin to user"}, status_code=400)
        
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            return JSONResponse({"error": "User not found"}, status_code=404)
        profile.role = role
        db.commit()
        return {"success": True}
    except ValueError:
        return JSONResponse({"error": "Invalid user_id format"}, status_code=400)
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/action-logs")
async def action_logs(_=Depends(require_superadmin), db: Session = Depends(get_db)):
    try:
        logs = db.query(ActionLog).order_by(desc(ActionLog.timestamp)).limit(500).all()
        return [
            {
                "id": str(log.id),
                "user_id": str(log.user_id),
                "action": log.action,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None
            }
            for log in logs
        ]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/workflow-access")
async def workflow_access(_=Depends(require_superadmin), db: Session = Depends(get_db)):
    try:
        access_records = db.query(UserWorkflowAccess).all()
        return [
            {
                "user_id": str(acc.user_id),
                "workflow_id": acc.workflow_id
            }
            for acc in access_records
        ]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/workflow-access/grant")
async def grant_workflow_access(request: Request, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    body = await request.json()
    user_id_str = body.get("user_id")
    workflow_id = body.get("workflow_id")
    if not user_id_str or not workflow_id:
        return JSONResponse({"error": "Missing user_id or workflow_id"}, status_code=400)
    try:
        user_id = uuid.UUID(user_id_str)
        # Check if access already exists
        existing = db.query(UserWorkflowAccess).filter(
            UserWorkflowAccess.user_id == user_id,
            UserWorkflowAccess.workflow_id == workflow_id
        ).first()
        if existing:
            return {"success": True}
        access = UserWorkflowAccess(user_id=user_id, workflow_id=workflow_id)
        db.add(access)
        db.commit()
        return {"success": True}
    except ValueError:
        return JSONResponse({"error": "Invalid user_id format"}, status_code=400)
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/workflow-access/grant-bulk")
async def grant_workflow_access_bulk(request: Request, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    """Grant workflow access to a user for multiple workflows in one call (idempotent)."""
    body = await request.json()
    user_id_str = body.get("user_id")
    workflow_ids = body.get("workflow_ids") or []
    if not user_id_str or not workflow_ids:
        return JSONResponse({"error": "Missing user_id or workflow_ids"}, status_code=400)
    try:
        user_id = uuid.UUID(user_id_str)
        workflow_id_set = {str(wf_id) for wf_id in workflow_ids if wf_id}
        if not workflow_id_set:
            return JSONResponse({"error": "workflow_ids is empty"}, status_code=400)

        # Find existing to keep operation idempotent
        existing_rows = db.query(UserWorkflowAccess.workflow_id).filter(
            UserWorkflowAccess.user_id == user_id,
            UserWorkflowAccess.workflow_id.in_(workflow_id_set)
        ).all()
        existing_ids = {row[0] for row in existing_rows}

        to_create = workflow_id_set - existing_ids
        for wf_id in to_create:
            db.add(UserWorkflowAccess(user_id=user_id, workflow_id=wf_id))
        db.commit()

        return {
            "granted": len(to_create),
            "skipped": len(existing_ids),
            "total_requested": len(workflow_id_set)
        }
    except ValueError:
        return JSONResponse({"error": "Invalid user_id format"}, status_code=400)
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/workflow-access/revoke")
async def revoke_workflow_access(request: Request, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    body = await request.json()
    user_id_str = body.get("user_id")
    workflow_id = body.get("workflow_id")
    if not user_id_str or not workflow_id:
        return JSONResponse({"error": "Missing user_id or workflow_id"}, status_code=400)
    try:
        user_id = uuid.UUID(user_id_str)
        access = db.query(UserWorkflowAccess).filter(
            UserWorkflowAccess.user_id == user_id,
            UserWorkflowAccess.workflow_id == workflow_id
        ).first()
        if access:
            db.delete(access)
            db.commit()
        return {"success": True}
    except ValueError:
        return JSONResponse({"error": "Invalid user_id format"}, status_code=400)
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/workflow-access/revoke-bulk")
async def revoke_workflow_access_bulk(request: Request, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    """Revoke workflow access for multiple workflows in one call (idempotent)."""
    body = await request.json()
    user_id_str = body.get("user_id")
    workflow_ids = body.get("workflow_ids") or []
    if not user_id_str or not workflow_ids:
        return JSONResponse({"error": "Missing user_id or workflow_ids"}, status_code=400)
    try:
        user_id = uuid.UUID(user_id_str)
        workflow_id_set = {str(wf_id) for wf_id in workflow_ids if wf_id}
        if not workflow_id_set:
            return JSONResponse({"error": "workflow_ids is empty"}, status_code=400)

        deleted = db.query(UserWorkflowAccess).filter(
            UserWorkflowAccess.user_id == user_id,
            UserWorkflowAccess.workflow_id.in_(workflow_id_set)
        ).delete(synchronize_session=False)
        db.commit()

        return {
            "revoked": deleted,
            "total_requested": len(workflow_id_set)
        }
    except ValueError:
        return JSONResponse({"error": "Invalid user_id format"}, status_code=400)
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)

# ---- n8n instances management ----

@router.get("/instances")
async def admin_instances_list(_=Depends(require_superadmin), db: Session = Depends(get_db)):
    try:
        instances = db.query(N8NInstance).order_by(N8NInstance.name).all()
        return [
            {
                "id": str(inst.id),
                "identifier": inst.identifier,
                "name": inst.name,
                "base_url": inst.base_url,
                "active": inst.active
            }
            for inst in instances
        ]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/instances")
async def admin_instances_create(request: Request, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    body = await request.json()
    identifier = (body.get("identifier") or "").strip() or None
    name = (body.get("name") or "").strip()
    base_url = (body.get("base_url") or "").strip()
    api_key = (body.get("api_key") or "").strip()
    active = bool(body.get("active", True))
    
    # Validate required fields
    if not name:
        return JSONResponse({"error": "Name is required"}, status_code=400)
    if not base_url:
        return JSONResponse({"error": "Base URL is required"}, status_code=400)
    if not api_key:
        return JSONResponse({"error": "API Key is required"}, status_code=400)
    try:
        instance = N8NInstance(
            identifier=identifier,
            name=name,
            base_url=base_url,
            api_key=api_key,
            active=active
        )
        db.add(instance)
        db.commit()
        db.refresh(instance)
        return {
            "id": str(instance.id),
            "identifier": instance.identifier,
            "name": instance.name,
            "base_url": instance.base_url,
            "active": instance.active
        }
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)

@router.put("/instances/{instance_id}")
async def admin_instances_update(instance_id: str, request: Request, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    body = await request.json()
    try:
        instance_uuid = uuid.UUID(instance_id)
        instance = db.query(N8NInstance).filter(N8NInstance.id == instance_uuid).first()
        if not instance:
            return JSONResponse({"error": "Instance not found"}, status_code=404)
        
        if "identifier" in body:
            instance.identifier = (body["identifier"] or "").strip() or None
        if "name" in body:
            name = (body["name"] or "").strip()
            if not name:
                return JSONResponse({"error": "Name is required"}, status_code=400)
            instance.name = name
        if "base_url" in body:
            base_url = (body["base_url"] or "").strip()
            if not base_url:
                return JSONResponse({"error": "Base URL is required"}, status_code=400)
            instance.base_url = base_url
        if "api_key" in body:
            api_key = (body["api_key"] or "").strip()
            if not api_key:
                return JSONResponse({"error": "API Key is required"}, status_code=400)
            instance.api_key = api_key
        if "active" in body:
            instance.active = bool(body["active"])
        
        db.commit()
        db.refresh(instance)
        return {
            "id": str(instance.id),
            "identifier": instance.identifier,
            "name": instance.name,
            "base_url": instance.base_url,
            "active": instance.active
        }
    except ValueError:
        return JSONResponse({"error": "Invalid instance_id format"}, status_code=400)
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)

@router.delete("/instances/{instance_id}")
async def admin_instances_delete(instance_id: str, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    try:
        instance_uuid = uuid.UUID(instance_id)
        instance = db.query(N8NInstance).filter(N8NInstance.id == instance_uuid).first()
        if instance:
            db.delete(instance)
            db.commit()
        return {"success": True}
    except ValueError:
        return JSONResponse({"error": "Invalid instance_id format"}, status_code=400)
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


