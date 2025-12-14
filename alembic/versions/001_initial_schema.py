"""Initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    # Check if tables exist before creating them (to handle init-db.sql running first)
    from sqlalchemy import inspect, text
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # Create profiles table
    if 'profiles' not in existing_tables:
        op.create_table(
            'profiles',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
            sa.Column('email', sa.Text(), nullable=False),
            sa.Column('role', sa.Text(), nullable=False, server_default='user'),
            sa.Column('pass', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.CheckConstraint("role IN ('user', 'superadmin')", name='check_role')
        )
        op.create_index('ix_profiles_email', 'profiles', ['email'], unique=True)
    
    # Create action_logs table
    if 'action_logs' not in existing_tables:
        op.create_table(
            'action_logs',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('action', sa.Text(), nullable=False),
            sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE')
        )
        op.create_index('ix_action_logs_user_id', 'action_logs', ['user_id'])
        op.create_index('ix_action_logs_timestamp', 'action_logs', ['timestamp'], postgresql_using='btree', postgresql_ops={'timestamp': 'DESC'})
    
    # Create n8n_workflows table
    if 'n8n_workflows' not in existing_tables:
        op.create_table(
            'n8n_workflows',
            sa.Column('id', sa.Text(), primary_key=True),
            sa.Column('name', sa.Text(), nullable=False),
            sa.Column('active', sa.Boolean(), server_default='false'),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now())
        )
        op.create_index('ix_n8n_workflows_updated_at', 'n8n_workflows', ['updated_at'], postgresql_using='btree', postgresql_ops={'updated_at': 'DESC'})
    
    # Create n8n_executions table
    if 'n8n_executions' not in existing_tables:
        op.create_table(
            'n8n_executions',
            sa.Column('id', sa.Text(), primary_key=True),
            sa.Column('workflow_id', sa.Text(), nullable=False),
            sa.Column('status', sa.Text(), nullable=False),
            sa.Column('finished', sa.Boolean(), server_default='false'),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('stopped_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['workflow_id'], ['n8n_workflows.id'], ondelete='CASCADE')
        )
        op.create_index('ix_n8n_executions_workflow_id', 'n8n_executions', ['workflow_id'])
        op.create_index('ix_n8n_executions_started_at', 'n8n_executions', ['started_at'], postgresql_using='btree', postgresql_ops={'started_at': 'DESC'})
    
    # Create user_workflow_access table
    if 'user_workflow_access' not in existing_tables:
        op.create_table(
            'user_workflow_access',
            sa.Column('user_id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('workflow_id', sa.Text(), primary_key=True),
            sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['workflow_id'], ['n8n_workflows.id'], ondelete='CASCADE')
        )
        op.create_index('ix_user_workflow_access_user_id', 'user_workflow_access', ['user_id'])
        op.create_index('ix_user_workflow_access_workflow_id', 'user_workflow_access', ['workflow_id'])
    
    # Create n8n_instances table
    if 'n8n_instances' not in existing_tables:
        op.create_table(
            'n8n_instances',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
            sa.Column('identifier', sa.Text(), nullable=True),
            sa.Column('name', sa.Text(), nullable=False),
            sa.Column('base_url', sa.Text(), nullable=False),
            sa.Column('api_key', sa.Text(), nullable=True),
            sa.Column('active', sa.Boolean(), server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now())
        )
        op.create_index('ix_n8n_instances_active', 'n8n_instances', ['active'], postgresql_where=sa.text('active = true'))


def downgrade() -> None:
    op.drop_table('n8n_instances')
    op.drop_table('user_workflow_access')
    op.drop_table('n8n_executions')
    op.drop_table('n8n_workflows')
    op.drop_table('action_logs')
    op.drop_table('profiles')

