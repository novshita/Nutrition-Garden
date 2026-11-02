"""add FIRST_WORKOUT and CONSISTENT_TRACKING milestone types

Revision ID: b7c4e1a9d3f2
Revises: dfe7e2e98457
Create Date: 2026-11-02 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

revision: str = "b7c4e1a9d3f2"
down_revision: str | None = "dfe7e2e98457"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # New enum values can't be used in the transaction that adds them, so commit them on their own.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE milestone_type ADD VALUE IF NOT EXISTS 'FIRST_WORKOUT'")
        op.execute("ALTER TYPE milestone_type ADD VALUE IF NOT EXISTS 'CONSISTENT_TRACKING'")


def downgrade() -> None:
    # PostgreSQL can't drop a single enum value; the extra values are harmless if unused.
    pass
