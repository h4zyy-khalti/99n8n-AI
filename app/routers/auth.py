import secrets
from datetime import datetime
import bcrypt
import jwt
from fastapi import APIRouter, Request, Depends, Query
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from ..core.config import JWT_SECRET, get_allowed_origins
from ..database.database import get_db
from ..database.models import Profile, ActionLog
from ..services.auth_service import get_authorization_url, verify_google_token, exchange_code_for_token
import uuid

router = APIRouter()

@router.get("/auth/login")
async def login():
    """Redirect to Google OAuth consent screen"""
    try:
        authorization_url, state = get_authorization_url()
        return RedirectResponse(url=authorization_url)
    except ValueError as e:
        # Configuration error - show helpful message
        error_msg = str(e)
        primary_frontend = get_allowed_origins()[0] if get_allowed_origins() else "http://localhost:3000"
        return RedirectResponse(f"{primary_frontend}/auth/callback?error={error_msg.replace(' ', '%20')}")
    except Exception as e:
        primary_frontend = get_allowed_origins()[0] if get_allowed_origins() else "http://localhost:3000"
        return RedirectResponse(f"{primary_frontend}/auth/callback?error=oauth_config_error")

@router.get("/auth/callback")
async def auth_callback_get(
    code: str = Query(None),
    error: str = Query(None),
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback (GET request with authorization code)"""
    if error:
        # Redirect to frontend with error
        primary_frontend = get_allowed_origins()[0] if get_allowed_origins() else "http://localhost:3000"
        return RedirectResponse(f"{primary_frontend}/auth/callback?error={error}")
    
    if not code:
        primary_frontend = get_allowed_origins()[0] if get_allowed_origins() else "http://localhost:3000"
        return RedirectResponse(f"{primary_frontend}/auth/callback?error=missing_code")
    
    try:
        # Exchange code for token and get user info
        token_data = exchange_code_for_token(code)
        user_info = token_data['user_info']
        
        # Process user login and get the token
        user_id_str = user_info['id']
        email = user_info['email']
        
        # Convert Google ID to UUID
        try:
            user_id = uuid.UUID(user_id_str[:32].ljust(32, '0'))
        except ValueError:
            import hashlib
            hash_obj = hashlib.md5(user_id_str.encode())
            user_id = uuid.UUID(hash_obj.hexdigest())
        
        # Check if any profiles exist (for superadmin assignment)
        existing_any = db.query(Profile).first()
        existing_profile = db.query(Profile).filter(Profile.id == user_id).first()
        
        if not existing_profile:
            random_password = secrets.token_urlsafe(12)
            hashed = bcrypt.hashpw(random_password.encode(), bcrypt.gensalt()).decode()
            role = "superadmin" if not existing_any else "user"
            profile = Profile(id=user_id, email=email, role=role, pass_hash=hashed)
            db.add(profile)
            db.commit()
        else:
            if existing_profile.email != email:
                existing_profile.email = email
                db.commit()
            role = existing_profile.role
        
        # Create JWT token
        payload = {"id": str(user_id), "email": email, "role": role}
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        
        # Log the action
        action_log = ActionLog(user_id=user_id, action="Logged in via Google OAuth", timestamp=datetime.utcnow())
        db.add(action_log)
        db.commit()
        
        # Redirect to frontend with cookie set
        primary_frontend = get_allowed_origins()[0] if get_allowed_origins() else "http://localhost:3000"
        redirect_response = RedirectResponse(url=f"{primary_frontend}/auth/callback?success=true")
        redirect_response.set_cookie("token", token, httponly=True, samesite="Lax")
        return redirect_response
    except ValueError as e:
        primary_frontend = get_allowed_origins()[0] if get_allowed_origins() else "http://localhost:3000"
        return RedirectResponse(f"{primary_frontend}/auth/callback?error={str(e)}")
    except Exception as e:
        primary_frontend = get_allowed_origins()[0] if get_allowed_origins() else "http://localhost:3000"
        return RedirectResponse(f"{primary_frontend}/auth/callback?error=authentication_failed")

@router.post("/auth/callback")
async def auth_callback_post(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback (POST request with ID token from frontend)"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse({"error": "Missing access token"}, status_code=400)
    
    id_token = auth_header.split(" ")[1]
    
    try:
        # Verify Google token
        user_info = verify_google_token(id_token)
        
        # Process user login
        return await _process_user_login(user_info, db)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=403)
    except Exception as e:
        return JSONResponse({"error": f"Authentication failed: {str(e)}"}, status_code=500)

async def _process_user_login(user_info: dict, db: Session):
    """Common logic to process user login and create/update profile"""
    user_id_str = user_info['id']
    email = user_info['email']
    
    # Convert Google ID to UUID (use a deterministic method)
    # We'll use the first 32 chars of the Google ID to create a UUID
    try:
        user_id = uuid.UUID(user_id_str[:32].ljust(32, '0'))
    except ValueError:
        # If conversion fails, hash the Google ID to create a UUID
        import hashlib
        hash_obj = hashlib.md5(user_id_str.encode())
        user_id = uuid.UUID(hash_obj.hexdigest())
    
    # Check if any profiles exist (for superadmin assignment)
    existing_any = db.query(Profile).first()
    
    # Check if user profile exists
    existing_profile = db.query(Profile).filter(Profile.id == user_id).first()
    
    if not existing_profile:
        # Create new profile
        random_password = secrets.token_urlsafe(12)
        hashed = bcrypt.hashpw(random_password.encode(), bcrypt.gensalt()).decode()
        role = "superadmin" if not existing_any else "user"
        
        profile = Profile(
            id=user_id,
            email=email,
            role=role,
            pass_hash=hashed
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    else:
        # Update email if changed
        if existing_profile.email != email:
            existing_profile.email = email
            db.commit()
        role = existing_profile.role
    
    # Create JWT token
    payload = {"id": str(user_id), "email": email, "role": role}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    
    # Log the action
    action_log = ActionLog(
        user_id=user_id,
        action="Logged in via Google OAuth",
        timestamp=datetime.utcnow()
    )
    db.add(action_log)
    db.commit()
    
    # Return response with cookie
    response = JSONResponse({"success": True})
    response.set_cookie("token", token, httponly=True, samesite="Lax")
    return response

@router.post("/auth/logout")
async def logout():
    """Clear the session cookie"""
    response = JSONResponse({"success": True})
    response.delete_cookie("token")
    return response


