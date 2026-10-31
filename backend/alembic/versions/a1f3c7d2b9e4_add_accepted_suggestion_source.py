"""add ACCEPTED_SUGGESTION calorie target source

Revision ID: a1f3c7d2b9e4
Revises: 589aabad0679
Create Date: 2026-10-31 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

revision: str = "a1f3c7d2b9e4"
down_revision: str | None = "589aabad0679"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A new enum value can't be used in the transaction that adds it, so commit it on its own.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE calorie_target_source ADD VALUE IF NOT EXISTS 'ACCEPTED_SUGGESTION'")


def downgrade() -> None:
    # PostgreSQL can't drop a single enum value; the extra value is harmless if unused.
    pass
