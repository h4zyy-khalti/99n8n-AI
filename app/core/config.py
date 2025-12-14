import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://n8n_user:n8n_password@postgres:5432/n8n_db")

# JWT Secret for session tokens
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")

# Frontend URLs (comma-separated for CORS)
FRONTEND_URLS = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:4000/auth/callback")

# n8n Configuration
N8N_URL = os.getenv("N8N_URL")
N8N_API_KEY = os.getenv("N8N_API_KEY")
LOCAL_N8N_URL = os.getenv("LOCAL_N8N_URL")
LOCAL_N8N_API_KEY = os.getenv("LOCAL_N8N_API_KEY")

def get_allowed_origins():
    return [o.strip() for o in FRONTEND_URLS.split(',') if o.strip()]


