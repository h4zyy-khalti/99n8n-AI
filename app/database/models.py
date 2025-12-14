from sqlalchemy import Column, String, Boolean, Text, ForeignKey, DateTime, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.database.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, unique=True, nullable=False, index=True)
    role = Column(Text, nullable=False, default="user")
    pass_hash = Column(Text, name="pass")  # Using name="pass" to match existing schema
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('user', 'superadmin')", name="check_role"),
    )

    # Relationships
    action_logs = relationship("ActionLog", back_populates="user", cascade="all, delete-orphan")
    workflow_access = relationship("UserWorkflowAccess", back_populates="user", cascade="all, delete-orphan")


class ActionLog(Base):
    __tablename__ = "action_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    user = relationship("Profile", back_populates="action_logs")


class N8NWorkflow(Base):
    __tablename__ = "n8n_workflows"

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    active = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    executions = relationship("N8NExecution", back_populates="workflow", cascade="all, delete-orphan")
    user_access = relationship("UserWorkflowAccess", back_populates="workflow", cascade="all, delete-orphan")


class N8NExecution(Base):
    __tablename__ = "n8n_executions"

    id = Column(Text, primary_key=True)
    workflow_id = Column(Text, ForeignKey("n8n_workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Text, nullable=False)
    finished = Column(Boolean, default=False)
    started_at = Column(DateTime(timezone=True), index=True)
    stopped_at = Column(DateTime(timezone=True))

    # Relationships
    workflow = relationship("N8NWorkflow", back_populates="executions")


class UserWorkflowAccess(Base):
    __tablename__ = "user_workflow_access"

    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True, index=True)
    workflow_id = Column(Text, ForeignKey("n8n_workflows.id", ondelete="CASCADE"), primary_key=True, index=True)

    # Relationships
    user = relationship("Profile", back_populates="workflow_access")
    workflow = relationship("N8NWorkflow", back_populates="user_access")


class N8NInstance(Base):
    __tablename__ = "n8n_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    identifier = Column(Text)
    name = Column(Text, nullable=False)
    base_url = Column(Text, nullable=False)
    api_key = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

