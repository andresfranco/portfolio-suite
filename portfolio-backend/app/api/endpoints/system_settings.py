from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.api import deps
from app.core.security_decorators import require_permission
from app.models.system_setting import SystemSetting
from typing import Optional

router = APIRouter()


def _get_setting(db: Session, key: str) -> Optional[SystemSetting]:
    return db.query(SystemSetting).filter(SystemSetting.key == key).first()


@router.get("/", response_model=Dict[str, Any])
@require_permission("SYSTEM_ADMIN")
def get_all_settings(db: Session = Depends(get_db), current_user=Depends(deps.get_current_user)):
    settings = db.query(SystemSetting).all()
    return {s.key: s.value for s in settings}


@router.get("/{key}", response_model=Dict[str, Any])
@require_permission("SYSTEM_ADMIN")
def get_setting(key: str, db: Session = Depends(get_db), current_user=Depends(deps.get_current_user)):
    s = _get_setting(db, key)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    return {"key": s.key, "value": s.value, "description": s.description}


@router.put("/{key}", response_model=Dict[str, Any])
@require_permission("SYSTEM_ADMIN")
def upsert_setting(key: str, body: Dict[str, Any], db: Session = Depends(get_db), current_user=Depends(deps.get_current_user)):
    value = str(body.get("value", ""))
    description = body.get("description")
    if value == "":
        raise HTTPException(status_code=400, detail="Value is required")
    s = _get_setting(db, key)
    if s:
        s.value = value
        if description is not None:
            s.description = description
    else:
        s = SystemSetting(key=key, value=value, description=description)
        db.add(s)
    db.commit()
    db.refresh(s)
    return {"key": s.key, "value": s.value, "description": s.description}


@router.delete("/{key}", status_code=204)
@require_permission("SYSTEM_ADMIN")
def delete_setting(key: str, db: Session = Depends(get_db), current_user=Depends(deps.get_current_user)):
    s = _get_setting(db, key)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    db.delete(s)
    db.commit()
    return {}


