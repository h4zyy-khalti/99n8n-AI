IME-KHALTI n8n Login Portal

Overview

- Full-stack app that authenticates users with Google (via Supabase), syncs n8n workflows/executions to Supabase, and exposes a role-based UI.
- Backend: FastAPI + Supabase client. Frontend: React.
- Data flow: Backend syncs from n8n → stores in Supabase → Frontend fetches from backend only. Users never call n8n directly.

Environment

Create a .env file in the project root:

```
SUPABASE_URL=...
SUPABASE_API_KEY=...
JWT_SECRET=change-me
N8N_URL=http://<n8n-host>:5678/api/v1
N8N_API_KEY=<optional-if-n8n-needs>
```

Supabase Tables

- profiles: id (uuid, PK, FK to auth.users.id), email (unique), role (text: user|superadmin), pass (text; not used for login now)
- action_logs: user_id (uuid), action (text), timestamp (timestamptz)
- n8n_workflows: id (text, PK), name (text), active (boolean), updated_at (timestamptz)
- n8n_executions: id (text, PK), workflow_id (text), status (text), finished (boolean), started_at (timestamptz), stopped_at (timestamptz)
- user_workflow_access: user_id (uuid), workflow_id (text)

Important Policies

- First user to login (when profiles is empty) becomes role=superadmin. Others are role=user.
- Non-superadmin users only see workflows/executions explicitly granted in user_workflow_access.
- Sync loop upserts workflows/executions and deletes stale ones no longer present in n8n (also cleans grants for those workflows).

Running Locally

Backend

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 4000
```

Frontend (create-react-app structure)

```
cd frontend
npm install
HOST=0.0.0.0 PORT=3000 npm start
```

Docker (frontend + backend in one image)

The Dockerfile builds the React app and serves it at 3000, and starts the FastAPI backend at 4000.

```
docker build -t n8n-portal-full .
docker run --env-file .env -p 3000:3000 -p 4000:4000 n8n-portal-full
```

Required environment (via .env or docker --env-file):

```
# Supabase
SUPABASE_URL=...             # e.g., https://<project>.supabase.co
SUPABASE_API_KEY=...         # service role or anon if policies fit (service recommended)
JWT_SECRET=change-me

# CORS and OAuth redirect origin(s) for frontend (comma-separated)
FRONTEND_URL=http://192.168.82.82:3000,http://localhost:3000

# n8n primary instance
N8N_URL=http://<n8n-host>:5678/api/v1
N8N_API_KEY=...

# Optional extra instance (env-defined)
LOCAL_N8N_URL=
LOCAL_N8N_API_KEY=
```

Also add this to Supabase Auth → Redirect URLs:

```
http://192.168.82.82:3000/auth/callback
```

API Reference (Backend)

Auth & Session

- GET /auth/login
  - Redirects to Supabase OAuth (Google). Uses SUPABASE_URL.
- POST /auth/callback
  - Frontend posts Authorization: Bearer <supabase_access_token>.
  - Verifies token, creates profile if missing. If profiles is empty, role=superadmin; otherwise role=user. Issues JWT cookie `token`.
- POST /auth/logout
  - Clears the session cookie.
- GET /me
  - Returns current profile: { id, email, role }.
- GET /dashboard
  - Requires session. Returns a basic welcome message.

Action Logs

- POST /log-action
  - Body: { action }
  - Appends to action_logs with user_id and timestamp.

n8n Proxy (Server-side Only)

- GET /n8n/workflows
- GET /n8n/executions
  - Convenience/testing endpoints which fetch directly from n8n (auth required). Not used by UI.

Data APIs (Read from Supabase)

- GET /workflows
  - Superadmin: all workflows.
  - User: only workflows present in user_workflow_access for the user.
- GET /executions
  - Superadmin: all executions.
  - User: executions whose workflow_id is granted.
- WebSocket /ws/n8n
  - Sends { type: "n8n_sync", counts, timestamp } after each backend sync tick.

Admin APIs (Superadmin only)

- GET /admin/users → [{ id, email, role }]
- POST /admin/users/role → set role. Body: { user_id, role: "user"|"superadmin" }
- GET /admin/action-logs → recent logs
- GET /admin/workflow-access → [{ user_id, workflow_id }]
- POST /admin/workflow-access/grant → Body: { user_id, workflow_id }
- POST /admin/workflow-access/revoke → Body: { user_id, workflow_id }

Sync Loop

- On startup, a background task runs every 15s:
  1) Fetch /workflows from n8n, normalize, upsert to n8n_workflows
  2) Fetch /executions from n8n, normalize, upsert to n8n_executions
  3) Reconcile: delete workflows not in API (and their executions and access grants); prune executions not present
  4) Broadcast a WebSocket message to clients

Frontend Behavior

- Login: Only “Continue with Google”.
- Dashboard: Metrics tiles; uses SidebarLayout which shows Admin button for superadmins.
- Workflows & Executions pages: fetch via backend; have search, pagination, rows-per-page; show a no-access message if empty for users.
- Admin page: Users (change role), User Access (grant/revoke workflow visibility), User Logs.

Security Notes

- The backend enforces access control. Do not fetch n8n directly in the frontend.
- Configure CORS for your frontend origin (`allow_origins`).
- If you enable RLS on Supabase tables, either use the service key or policies that allow the backend’s use-case.

Troubleshooting

- First login 500 with profiles_role_check → Update the CHECK to allow 'superadmin'.
- Empty UI for users → grant access in Admin → User Access.
- Pagination slow → server-side pagination endpoints can be re-enabled; current build uses full fetch with client pagination for simplicity.
- CORS/OAuth callback blocked → ensure FRONTEND_URL includes the exact origin you open, and Supabase redirect URL matches.

Multi-instance n8n

- Instances are loaded from env (N8N_URL/N8N_API_KEY and LOCAL_N8N_URL/LOCAL_N8N_API_KEY) and from the `n8n_instances` table if present (columns: id, name, base_url, api_key, active boolean).
- The sync loop iterates all instances, prefixes IDs per instance (e.g., env:123, inst_42:789), merges, upserts, and reconciles deletions.
- UI shows an Instance column and provides an instance filter.

Schema notes

- `user_workflow_access.workflow_id` must be text to store prefixed workflow ids. Recommended:
  - unique index on (user_id, workflow_id)
  - FK to `n8n_workflows(id)` with on delete cascade



