"""civitas schema migration

Revision ID: 0002_civitas
Revises: 0001_init
Create Date: 2026-01-31

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_civitas"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old tables
    op.drop_table("medical_records")
    op.drop_table("financial_records")

    # Remove password_hash from users (WebAuthn replaces passwords)
    op.drop_column("users", "password_hash")

    # Create webauthn_credentials table
    op.create_table(
        "webauthn_credentials",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("credential_id", sa.LargeBinary(), nullable=False),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("counter", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transports", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_webauthn_credentials_user_id", "webauthn_credentials", ["user_id"])
    op.create_index("ix_webauthn_credentials_credential_id", "webauthn_credentials", ["credential_id"], unique=True)

    # Create unified data_records table
    op.create_table(
        "data_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),  # medical, financial, legal, identity
        sa.Column("record_type", sa.String(length=64), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_data_records_user_id", "data_records", ["user_id"])
    op.create_index("ix_data_records_category", "data_records", ["category"])
    op.create_index("ix_data_records_record_type", "data_records", ["record_type"])
    op.create_index("ix_data_records_date", "data_records", ["date"])

    # Add tags column to documents
    op.add_column("documents", sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Rename grantee_email to grantee_identifier in access_grants
    op.drop_index("ix_access_grants_grantee_email", table_name="access_grants")
    op.alter_column("access_grants", "grantee_email", new_column_name="grantee_identifier")
    op.create_index("ix_access_grants_grantee_identifier", "access_grants", ["grantee_identifier"])


def downgrade() -> None:
    # Revert access_grants column rename
    op.drop_index("ix_access_grants_grantee_identifier", table_name="access_grants")
    op.alter_column("access_grants", "grantee_identifier", new_column_name="grantee_email")
    op.create_index("ix_access_grants_grantee_email", "access_grants", ["grantee_email"])

    # Remove tags from documents
    op.drop_column("documents", "tags")

    # Drop new tables
    op.drop_table("data_records")
    op.drop_table("webauthn_credentials")

    # Restore password_hash column
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=False, server_default=""))

    # Recreate old tables
    op.create_table(
        "medical_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("record_type", sa.String(length=50), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_medical_records_user_id", "medical_records", ["user_id"])
    op.create_index("ix_medical_records_record_type", "medical_records", ["record_type"])
    op.create_index("ix_medical_records_date", "medical_records", ["date"])

    op.create_table(
        "financial_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("record_type", sa.String(length=64), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_financial_records_user_id", "financial_records", ["user_id"])
    op.create_index("ix_financial_records_record_type", "financial_records", ["record_type"])
    op.create_index("ix_financial_records_date", "financial_records", ["date"])
