from typing import Literal, TypedDict, List, Dict, Any


class RagEvent(TypedDict):
    op: Literal["insert", "update", "delete"]
    source_table: str
    source_id: str
    changed_fields: List[str]


def stage_event(session, ev: RagEvent) -> None:
    session.info.setdefault("rag_events", []).append(ev)


