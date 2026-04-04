"""Centralized credential service for agent API key management.

This module is the single source of truth for all credential encryption,
decryption, and resolution operations. It replaces the scattered
``_decrypt_api_key`` / ``_encrypt_api_key`` helpers in chat_service.py,
rag_service.py, and agents.py.

All consumers (chat, RAG, career tasks) should call this service instead
of executing pgcrypto SQL directly.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.agent import AgentCredential

logger = logging.getLogger(__name__)


class CredentialService:
    """Single source of truth for agent credential operations."""

    # ── Encryption / Decryption ─────────────────────────────────────────────

    @staticmethod
    def encrypt_api_key(db: Session, api_key: str) -> str:
        """Encrypt an API key using pgcrypto.

        Returns a base64-encoded ciphertext string suitable for storing in
        ``agent_credentials.api_key_encrypted``.

        Raises ``ValueError`` if ``AGENT_KMS_KEY`` is not set or pgcrypto fails.
        """
        kms_key = os.getenv("AGENT_KMS_KEY")
        if not kms_key:
            raise ValueError("AGENT_KMS_KEY env is not set on the backend process")
        row = db.execute(
            text("SELECT encode(pgp_sym_encrypt(:t, :k), 'base64')"),
            {"t": api_key, "k": kms_key},
        ).first()
        if not row or not row[0]:
            raise ValueError(
                "Failed to encrypt API key (check pgcrypto extension and AGENT_KMS_KEY)"
            )
        return row[0]

    @staticmethod
    def decrypt_api_key(db: Session, encrypted: str) -> str:
        """Decrypt a base64-encoded pgcrypto ciphertext.

        Returns the plaintext API key.

        Raises ``ValueError`` if ``AGENT_KMS_KEY`` is not set or decryption fails.
        """
        kms_key = os.getenv("AGENT_KMS_KEY")
        if not kms_key:
            raise ValueError("AGENT_KMS_KEY env is not set on the backend process")
        row = db.execute(
            text("SELECT pgp_sym_decrypt(decode(:b64, 'base64'), :k) AS api_key"),
            {"b64": encrypted, "k": kms_key},
        ).first()
        return row[0] if row and row[0] else ""

    # ── Credential lookup ───────────────────────────────────────────────────

    @staticmethod
    def get_credential(db: Session, credential_id: int) -> AgentCredential:
        """Load a credential by ID.

        Raises ``HTTPException(404)`` if not found.
        """
        cred = db.query(AgentCredential).filter(AgentCredential.id == credential_id).first()
        if not cred:
            raise HTTPException(status_code=404, detail="Credential not found")
        return cred

    @staticmethod
    def resolve_api_key(db: Session, credential_id: int) -> str:
        """Load and decrypt a credential's API key in one call.

        Also updates ``last_used_at`` on the credential row.
        """
        from sqlalchemy import func as _func

        cred = CredentialService.get_credential(db, credential_id)
        if not cred.api_key_encrypted:
            raise ValueError(f"Credential {credential_id} has no encrypted API key stored")
        api_key = CredentialService.decrypt_api_key(db, cred.api_key_encrypted)
        # Best-effort timestamp update — non-fatal if it fails
        try:
            db.execute(
                text(
                    "UPDATE agent_credentials SET last_used_at = now() WHERE id = :id"
                ),
                {"id": credential_id},
            )
            db.commit()
        except Exception as e:
            logger.warning("Could not update last_used_at for credential %d: %s", credential_id, e)
            try:
                db.rollback()
            except Exception:
                pass
        return api_key

    @staticmethod
    def get_credential_by_purpose(
        db: Session, purpose: str, active_only: bool = True
    ) -> Optional[AgentCredential]:
        """Find the first active credential tagged with the given purpose.

        Uses the JSONB ``@>`` containment operator so it works on any array
        that includes the given purpose string.

        Example: ``purpose='career_primary'`` matches ``["career_primary"]`` and
        ``["career_primary","chat"]``.
        """
        query = db.query(AgentCredential).filter(
            AgentCredential.purpose.op("@>")(f'["{purpose}"]')
        )
        if active_only:
            query = query.filter(AgentCredential.is_active == True)
        return query.order_by(AgentCredential.id.asc()).first()

    @staticmethod
    def resolve_provider_config(
        db: Session,
        credential_id: int,
        model_override: Optional[str] = None,
    ) -> dict:
        """Return a provider config dict ready for ``build_provider()``.

        Returns::

            {
                "provider": "openai",
                "api_key": "<decrypted>",
                "base_url": "https://api.groq.com/openai/v1",  # or None
                "model": "qwen/qwen3-32b",
            }

        Falls back to ``credential.model_default`` when no ``model_override`` is given.
        Falls back to ``extra->>'base_url'`` when the first-class ``base_url`` column
        is empty (backward-compatible with credentials stored before the migration).
        """
        cred = CredentialService.get_credential(db, credential_id)
        api_key = CredentialService.decrypt_api_key(db, cred.api_key_encrypted or "")
        # Prefer first-class base_url; fall back to legacy extra->>'base_url'
        base_url = cred.base_url or (cred.extra or {}).get("base_url")
        model = model_override or cred.model_default
        # Update last_used_at (best-effort)
        try:
            db.execute(
                text("UPDATE agent_credentials SET last_used_at = now() WHERE id = :id"),
                {"id": credential_id},
            )
            db.commit()
        except Exception as e:
            logger.warning("Could not update last_used_at for credential %d: %s", credential_id, e)
            try:
                db.rollback()
            except Exception:
                pass
        return {
            "provider": cred.provider,
            "api_key": api_key,
            "base_url": base_url,
            "model": model,
        }
