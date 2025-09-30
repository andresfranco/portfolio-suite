from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any, List
from app.api import deps
import os
from app.core.security_decorators import require_any_permission
from app.schemas.agent import (
    AgentCredentialCreate,
    AgentCredentialOut,
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

router = APIRouter()


def _encrypt_api_key(db: Session, api_key: str) -> str:
    # Use pgp_sym_encrypt with a server-side key provided via env (AGENT_KMS_KEY)
    kms_key = os.getenv("AGENT_KMS_KEY")
    if not kms_key:
        raise ValueError("AGENT_KMS_KEY env is not set on the backend process")
    row = db.execute(text("SELECT encode(pgp_sym_encrypt(:t, :k), 'base64')"), {"t": api_key, "k": kms_key}).first()
    if not row or not row[0]:
        raise ValueError("Failed to encrypt API key (check pgcrypto extension and AGENT_KMS_KEY)")
    return row[0]


@router.post("/credentials", response_model=AgentCredentialOut)
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # SYSTEM_ADMIN allowed implicitly
def create_credential(
    *,
    db: Session = Depends(deps.get_db),
    cred_in: AgentCredentialCreate,
    current_user=Depends(deps.get_current_user),
):
    # Never store plain API key; encrypt at rest
    enc = _encrypt_api_key(db, cred_in.api_key)
    cred = AgentCredential(name=cred_in.name, provider=cred_in.provider, api_key_encrypted=enc, extra=cred_in.extra)
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred


@router.get("/credentials", response_model=List[AgentCredentialOut])
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # no secret leakage
def list_credentials(
    *,
    db: Session = Depends(deps.get_db),
    current_user=Depends(deps.get_current_user),
):
    creds = db.query(AgentCredential).order_by(AgentCredential.name.asc()).all()
    return creds


@router.get("/", response_model=List[AgentOut])
@require_any_permission(["MANAGE_AGENTS", "SYSTEM_ADMIN"])  # list agents
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


