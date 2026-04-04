from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any, List, Optional
from app.api import deps
from app.core.security_decorators import require_any_permission
from app.schemas.agent import (
    AgentCredentialCreate,
    AgentCredentialUpdate,
    AgentCredentialRotate,
    AgentCredentialOut,
    CredentialAssignments,
    AgentCreate,
    AgentUpdate,
    AgentOut,
    AgentTemplateCreate,
    AgentTemplateOut,
    AgentTestRequest,
    AgentTestResponse,
    ChatRequest,
)
from app.models.agent import Agent, AgentCredential, AgentTemplate
from app.services.chat_service import run_agent_test, run_agent_chat
from app.services.chat_service_async import run_agent_chat_stream
from app.services.credential_service import CredentialService

router = APIRouter()


@router.post("/credentials", response_model=AgentCredentialOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # SYSTEM_ADMIN allowed implicitly
def create_credential(
    *,
    db: Session = Depends(deps.get_db),
    cred_in: AgentCredentialCreate,
    current_user=Depends(deps.get_current_user),
):
    """Create a new agent API credential. The API key is encrypted at rest with pgcrypto."""
    enc = CredentialService.encrypt_api_key(db, cred_in.api_key)
    cred = AgentCredential(
        name=cred_in.name,
        provider=cred_in.provider,
        api_key_encrypted=enc,
        extra=cred_in.extra,
        base_url=cred_in.base_url,
        model_default=cred_in.model_default,
        purpose=cred_in.purpose,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred


@router.get("/credentials", response_model=List[AgentCredentialOut])
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # no secret leakage
def list_credentials(
    *,
    db: Session = Depends(deps.get_db),
    purpose: Optional[str] = Query(None, description="Filter credentials by purpose tag (e.g. 'chat', 'embedding', 'career_primary')"),
    active_only: bool = Query(False, description="When true, return only active credentials"),
    current_user=Depends(deps.get_current_user),
):
    """List all agent credentials. Optionally filter by purpose tag or active status."""
    query = db.query(AgentCredential)
    if purpose:
        query = query.filter(AgentCredential.purpose.op("@>")(f'["{purpose}"]'))
    if active_only:
        query = query.filter(AgentCredential.is_active == True)
    creds = query.order_by(AgentCredential.name.asc()).all()
    return creds


@router.put("/credentials/{credential_id}", response_model=AgentCredentialOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # update credential
def update_credential(
    *,
    credential_id: int,
    db: Session = Depends(deps.get_db),
    cred_in: AgentCredentialUpdate = Body(...),
    current_user=Depends(deps.get_current_user),
):
    """
    Update an agent API credential.

    Use ``POST /credentials/{id}/rotate`` to replace the API key.

    Raises:
        404: If credential not found
        409: If updating name to one that already exists
    """
    credential = db.query(AgentCredential).filter(AgentCredential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Check if new name conflicts with an existing credential
    if cred_in.name and cred_in.name != credential.name:
        existing = db.query(AgentCredential).filter(
            AgentCredential.name == cred_in.name,
            AgentCredential.id != credential_id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A credential with name '{cred_in.name}' already exists",
            )

    update_data = cred_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(credential, field, value)
    credential.updated_by = current_user.id

    db.commit()
    db.refresh(credential)
    return credential


@router.post("/credentials/{credential_id}/rotate", response_model=AgentCredentialOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])
def rotate_credential(
    *,
    credential_id: int,
    db: Session = Depends(deps.get_db),
    body: AgentCredentialRotate = Body(...),
    current_user=Depends(deps.get_current_user),
):
    """Replace the API key on an existing credential.

    The new key is encrypted with pgcrypto before storage. The credential
    name, provider, and all other metadata are unchanged.

    Raises:
        404: If credential not found
    """
    credential = db.query(AgentCredential).filter(AgentCredential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    credential.api_key_encrypted = CredentialService.encrypt_api_key(db, body.api_key)
    credential.updated_by = current_user.id
    db.commit()
    db.refresh(credential)
    return credential


@router.post("/credentials/{credential_id}/test")
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])
def test_credential(
    *,
    credential_id: int,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    """Send a minimal ping to the provider associated with a credential.

    Returns {success, provider, model, latency_ms, response?, error?}.
    """
    import time as _time
    from app.services.llm.providers import build_provider

    credential = db.query(AgentCredential).filter(AgentCredential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    if not credential.api_key_encrypted:
        return {"success": False, "provider": credential.provider, "model": credential.model_default, "error": "No API key stored"}

    try:
        config = CredentialService.resolve_provider_config(db, credential_id)
    except Exception as exc:
        return {"success": False, "provider": credential.provider, "model": credential.model_default, "error": str(exc)}

    model = config["model"] or "gpt-4o-mini"
    started = _time.time()
    try:
        provider = build_provider(config["provider"], api_key=config["api_key"], base_url=config["base_url"])
        result = provider.chat(
            model=model,
            system_prompt="You are a test assistant. Reply with exactly: OK",
            messages=[{"role": "user", "content": "ping"}],
        )
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "success": True,
            "provider": config["provider"],
            "model": model,
            "response": result["text"][:100],
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "success": False,
            "provider": config["provider"],
            "model": model,
            "error": str(exc),
            "latency_ms": latency_ms,
        }


def _read_credential_assignments(db: Session) -> CredentialAssignments:
    """Internal helper — reads credential-assignment system_settings rows."""
    keys = [
        "career.credential_id",
        "career.model",
        "career.fallback_credential_id",
        "career.fallback_model",
        "embed.credential_id",
        "anthropic.credential_id",
    ]
    rows = db.execute(
        text("SELECT key, value FROM system_settings WHERE key = ANY(:keys)"),
        {"keys": keys},
    ).fetchall()
    settings = {r[0]: r[1] for r in rows}

    def _int(k):
        v = settings.get(k)
        return int(v) if v and v.isdigit() else None

    return CredentialAssignments(
        career_credential_id=_int("career.credential_id"),
        career_model=settings.get("career.model"),
        career_fallback_id=_int("career.fallback_credential_id"),
        career_fallback_model=settings.get("career.fallback_model"),
        embed_credential_id=_int("embed.credential_id"),
        anthropic_credential_id=_int("anthropic.credential_id"),
    )


@router.get("/credential-assignments", response_model=CredentialAssignments)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])
def get_credential_assignments(
    *,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    """Return the current system_settings keys that map roles to credentials."""
    return _read_credential_assignments(db)


@router.put("/credential-assignments", response_model=CredentialAssignments)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])
def update_credential_assignments(
    *,
    db: Session = Depends(deps.get_db),
    assignments: CredentialAssignments = Body(...),
    current_user=Depends(deps.get_current_user),
):
    """Persist system_settings keys that map system roles to credentials.

    Sending ``null`` for a field clears that system_setting (the role will
    fall back to environment variables).
    """
    mapping = {
        "career.credential_id": str(assignments.career_credential_id) if assignments.career_credential_id is not None else None,
        "career.model": assignments.career_model,
        "career.fallback_credential_id": str(assignments.career_fallback_id) if assignments.career_fallback_id is not None else None,
        "career.fallback_model": assignments.career_fallback_model,
        "embed.credential_id": str(assignments.embed_credential_id) if assignments.embed_credential_id is not None else None,
        "anthropic.credential_id": str(assignments.anthropic_credential_id) if assignments.anthropic_credential_id is not None else None,
    }
    for key, value in mapping.items():
        if value is not None:
            db.execute(
                text(
                    "INSERT INTO system_settings (key, value) VALUES (:k, :v) "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
                ),
                {"k": key, "v": value},
            )
        else:
            db.execute(
                text("DELETE FROM system_settings WHERE key = :k"),
                {"k": key},
            )
    db.commit()

    # Return the saved state
    return _read_credential_assignments(db)


@router.delete("/credentials/{credential_id}")
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # delete credential
def delete_credential(
    *,
    credential_id: int,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    """
    Delete an agent API credential if it's not associated with any agent.
    
    Raises:
        404: If credential not found
        409: If credential is associated with one or more agents
    """
    credential = db.query(AgentCredential).filter(AgentCredential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Check if any agents are using this credential
    associated_agents = db.query(Agent).filter(Agent.credential_id == credential_id).all()
    if associated_agents:
        agent_names = [agent.name for agent in associated_agents]
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete credential. It is currently associated with {len(associated_agents)} agent(s): {', '.join(agent_names)}"
        )
    
    db.delete(credential)
    db.commit()
    return {"message": "Credential deleted successfully"}


@router.get("/", response_model=List[AgentOut])
@require_any_permission(["MANAGE_AGENTS", "EDIT_PORTFOLIO", "SYSTEM_ADMIN"])  # list agents for admin and portfolio assignment
def list_agents(
    *,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    agents = db.query(Agent).order_by(Agent.name.asc()).all()
    return agents


@router.get("/{agent_id}/template", response_model=AgentTemplateOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # read template
def get_agent_template(
    *,
    agent_id: int,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    tpl = db.query(AgentTemplate).filter(AgentTemplate.agent_id == agent_id).first()
    if not tpl:
        # Return a transient default response (not persisted)
        tpl = AgentTemplate(agent_id=agent_id, system_prompt="You are a helpful assistant that answers strictly from the provided context. If the context does not contain the answer, say you don't know.")
    return tpl


@router.post("/", response_model=AgentOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # create agent
def create_agent(
    *,
    db: Session = Depends(deps.get_db),
    agent_in: AgentCreate,
    current_user=Depends(deps.get_current_user),
):
    agent = Agent(**agent_in.model_dump())
    # Default low-cost chat model for OpenAI as requested; compare gpt-4o-mini vs gpt-4o-mini-transcribe-like is out of scope; use stable default
    if not agent.chat_model and agent_in:
        agent.chat_model = "gpt-4o-mini"
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.put("/{agent_id}", response_model=AgentOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # update agent
def update_agent(
    *,
    agent_id: int,
    db: Session = Depends(deps.get_db),
    agent_in: AgentUpdate,
    current_user=Depends(deps.get_current_user),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for k, v in agent_in.model_dump(exclude_unset=True).items():
        setattr(agent, k, v)
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}")
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # delete agent
def delete_agent(
    *,
    agent_id: int,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()
    return {"message": "Agent deleted successfully"}


@router.post("/templates", response_model=AgentTemplateOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # upsert template
def upsert_template(
    *,
    db: Session = Depends(deps.get_db),
    tpl_in: AgentTemplateCreate,
    current_user=Depends(deps.get_current_user),
):
    # If name provided, upsert by (agent_id, name); otherwise upsert the (legacy) single template
    tpl = None
    if tpl_in.name:
        tpl = db.query(AgentTemplate).filter(AgentTemplate.agent_id == tpl_in.agent_id, AgentTemplate.name == tpl_in.name).first()
    else:
        tpl = db.query(AgentTemplate).filter(AgentTemplate.agent_id == tpl_in.agent_id, AgentTemplate.name.is_(None)).first()

    if not tpl:
        tpl = AgentTemplate(**tpl_in.model_dump())
        db.add(tpl)
    else:
        for k, v in tpl_in.model_dump(exclude_unset=True).items():
            setattr(tpl, k, v)

    # Ensure only one default per agent
    if tpl_in.is_default:
        db.query(AgentTemplate).filter(AgentTemplate.agent_id == tpl.agent_id, AgentTemplate.id != tpl.id).update({AgentTemplate.is_default: False})
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("/{agent_id}/templates", response_model=List[AgentTemplateOut])
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # list templates
def list_templates(
    *,
    agent_id: int,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    tpls = db.query(AgentTemplate).filter(AgentTemplate.agent_id == agent_id).order_by(AgentTemplate.is_default.desc(), AgentTemplate.name.asc().nullsfirst()).all()
    return tpls


@router.post("/test", response_model=AgentTestResponse)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # test endpoint
def test_agent(
    *,
    db: Session = Depends(deps.get_db),
    req: AgentTestRequest,
    current_user=Depends(deps.get_current_user),
):
    return run_agent_test(db, agent_id=req.agent_id, prompt=req.prompt, template_id=req.template_id, portfolio_id=req.portfolio_id, portfolio_query=getattr(req, 'portfolio_query', None))


@router.post("/{agent_id}/chat")
def agent_chat(
    *,
    db: Session = Depends(deps.get_db),
    agent_id: int,
    payload: ChatRequest,
    current_user=Depends(deps.get_current_user),
):
    # Non-streaming response
    return run_agent_chat(db, agent_id=agent_id, user_message=payload.message, session_id=payload.session_id, template_id=None, portfolio_id=payload.portfolio_id, portfolio_query=getattr(payload, 'portfolio_query', None), language_id=getattr(payload, 'language_id', None))


@router.post("/{agent_id}/chat/stream")
async def agent_chat_stream(
    *,
    db: Session = Depends(deps.get_db),
    agent_id: int,
    payload: ChatRequest,
    current_user=Depends(deps.get_current_user),
):
    """
    Streaming chat endpoint using Server-Sent Events (SSE).
    
    Returns a stream of JSON events:
    - {"type": "token", "content": "text chunk"}
    - {"type": "done", "citations": [...], "cached": true/false}
    - {"type": "error", "message": "error details"}
    
    Performance improvements:
    - Time-to-first-token: <500ms (vs 7-37s for full response)
    - Cached responses: <5ms for identical queries
    - Dynamic context sizing based on query complexity
    """
    return StreamingResponse(
        run_agent_chat_stream(
            db,
            agent_id=agent_id,
            user_message=payload.message,
            session_id=payload.session_id,
            template_id=None,
            portfolio_id=payload.portfolio_id,
            portfolio_query=getattr(payload, 'portfolio_query', None),
            language_id=getattr(payload, 'language_id', None)
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
