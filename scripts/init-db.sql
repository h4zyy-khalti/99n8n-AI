-- Initialize database schema for n8n portal
-- This script runs automatically when PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table: User profiles with roles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'superadmin')),
    pass TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Action logs table: User action audit trail
CREATE TABLE IF NOT EXISTS action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- n8n workflows table: Synced n8n workflows
CREATE TABLE IF NOT EXISTS n8n_workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- n8n executions table: Synced n8n executions
CREATE TABLE IF NOT EXISTS n8n_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES n8n_workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    finished BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ
);

-- User workflow access table: User workflow permissions
CREATE TABLE IF NOT EXISTS user_workflow_access (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workflow_id TEXT NOT NULL REFERENCES n8n_workflows(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, workflow_id)
);

-- n8n instances table: n8n instance configuration
CREATE TABLE IF NOT EXISTS n8n_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier TEXT,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_workflows_updated_at ON n8n_workflows(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_workflow_id ON n8n_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_started_at ON n8n_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_workflow_access_user_id ON user_workflow_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workflow_access_workflow_id ON user_workflow_access(workflow_id);
CREATE INDEX IF NOT EXISTS idx_n8n_instances_active ON n8n_instances(active) WHERE active = TRUE;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_n8n_instances_updated_at BEFORE UPDATE ON n8n_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

