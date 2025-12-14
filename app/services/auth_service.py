from google.auth.transport.requests import Request
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
import os
from ..core.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

# Google OAuth scopes
SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']

def get_google_oauth_flow():
    """Create and return Google OAuth flow"""
    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID.startswith("your-google"):
        raise ValueError("GOOGLE_CLIENT_ID is not configured. Please set it in your .env file.")
    if not GOOGLE_CLIENT_SECRET or GOOGLE_CLIENT_SECRET.startswith("your-google"):
        raise ValueError("GOOGLE_CLIENT_SECRET is not configured. Please set it in your .env file.")
    
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    return flow

def get_authorization_url():
    """Get Google OAuth authorization URL"""
    flow = get_google_oauth_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    return authorization_url, state

def verify_google_token(token: str):
    """Verify Google OAuth token and return user info"""
    try:
        # Verify the token with clock skew tolerance (120 seconds)
        idinfo = id_token.verify_oauth2_token(
            token,
            Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=120  # Allow 120 seconds of clock skew
        )                                                               
        
        # Check if email is from khalti.com domain
        email = idinfo.get('email')
        if not email or not email.endswith('@khalti.com'):
            raise ValueError("Only @khalti.com email addresses are allowed")
        
        return {
            'id': idinfo.get('sub'),  # Google user ID
            'email': email,
            'name': idinfo.get('name'),
            'picture': idinfo.get('picture')
        }
    except ValueError as e:
        raise e
    except Exception as e:
        raise ValueError(f"Invalid token: {str(e)}")

def exchange_code_for_token(code: str):
    """Exchange authorization code for tokens"""
    flow = get_google_oauth_flow()
    flow.fetch_token(code=code)
    
    # Get credentials
    credentials = flow.credentials
    
    # Get user info from ID token with clock skew tolerance
    idinfo = id_token.verify_oauth2_token(
        credentials.id_token,
        Request(),
        GOOGLE_CLIENT_ID,
        clock_skew_in_seconds=120  # Allow 120 seconds of clock skew
    )
    
    # Check email domain
    email = idinfo.get('email')
    if not email or not email.endswith('@khalti.com'):
        raise ValueError("Only @khalti.com email addresses are allowed")
    
    return {
        'access_token': credentials.token,
        'id_token': credentials.id_token,
        'user_info': {
            'id': idinfo.get('sub'),
            'email': email,
            'name': idinfo.get('name'),
            'picture': idinfo.get('picture')
        }
    }

