"""Remove user_access column from n8n_workflows if it exists."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "002_remove_user_access_column"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop column safely if it exists (handles legacy DBs)
    op.execute("ALTER TABLE IF EXISTS n8n_workflows DROP COLUMN IF EXISTS user_access;")


def downgrade() -> None:
    # Recreate the column on downgrade (as TEXT to remain compatible with older schemas)
    op.add_column("n8n_workflows", sa.Column("user_access", sa.Text(), nullable=True))

