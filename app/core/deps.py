from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
import jwt
from .config import JWT_SECRET
from app.database.database import get_db
from app.database.models import Profile

def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")
    return payload

def require_superadmin(user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        profile = db.query(Profile).filter(Profile.id == user["id"]).first()
        if not profile or profile.role != "superadmin":
            raise HTTPException(403, "Forbidden")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(403, "Forbidden")


