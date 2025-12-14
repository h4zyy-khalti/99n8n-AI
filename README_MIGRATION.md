# Migration from Supabase to Dockerized PostgreSQL

This document outlines the changes made to migrate from Supabase to a self-hosted PostgreSQL database.

## Key Changes

### 1. Database Infrastructure
- Added PostgreSQL service to `docker-compose.yml`
- Created database initialization script (`scripts/init-db.sql`)
- Database data is persisted in Docker volume `postgres_data`

### 2. Authentication
- Replaced Supabase Auth with direct Google OAuth
- Only `@khalti.com` email addresses are allowed to login
- Google OAuth credentials must be configured in `.env`

### 3. Database Access
- Replaced Supabase client with SQLAlchemy ORM
- All database queries now use SQLAlchemy models
- Alembic is used for database migrations

### 4. Environment Variables

**Removed:**
- `SUPABASE_URL`
- `SUPABASE_API_KEY`

**Added:**
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI (default: http://localhost:4000/auth/callback)
- `POSTGRES_DB` - Database name (default: n8n_db)
- `POSTGRES_USER` - Database user (default: n8n_user)
- `POSTGRES_PASSWORD` - Database password (default: n8n_password)

## Setup Instructions

1. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Configure Google OAuth:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:4000/auth/callback`
   - Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

3. **Start the services:**
   ```bash
   docker-compose up -d
   ```

4. **Run migrations** (if needed):
   ```bash
   docker-compose exec backend alembic upgrade head
   ```

## Database Schema

The database includes the following tables:
- `profiles` - User profiles with roles
- `action_logs` - User action audit trail
- `n8n_workflows` - Synced n8n workflows
- `n8n_executions` - Synced n8n executions
- `user_workflow_access` - User workflow permissions
- `n8n_instances` - n8n instance configuration

## Migration Notes

- The database is initialized automatically on first startup via `init-db.sql`
- Alembic migrations run automatically on container startup
- All Supabase-specific code has been removed
- The application now uses SQLAlchemy for all database operations

