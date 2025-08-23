from typing import Dict, List, Tuple
import os
import logging
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from hashlib import sha256 as _sha256
from app.rag.chunking import chunk_text
from app.rag.embedding import embed_text_batch
from app.rag.storage import extract_text_from_uri
from app.observability.metrics import rag_chunks_retired, rag_chunks_new, rag_chunks_updated, rag_chunks_skipped, rag_embeddings_upserted
import re
try:
    import html2text as _html2text  # type: ignore
except Exception:
    _html2text = None
try:
    from markdown_it import MarkdownIt  # type: ignore
except Exception:
    MarkdownIt = None  # type: ignore

logger = logging.getLogger(__name__)

def _sanitize_text(value: str) -> str:
    if not value:
        return ""
    # Remove NULs
    cleaned = value.replace("\x00", " ")
    # Strip simple markdown artifacts
    cleaned = re.sub(r"`{1,3}", " ", cleaned)  # backticks
    cleaned = re.sub(r"^\s{0,3}#[^\n]*", " ", cleaned, flags=re.MULTILINE)  # headings
    cleaned = re.sub(r"!\[[^\]]*\]\([^\)]*\)", " ", cleaned)  # images
    cleaned = re.sub(r"\[[^\]]*\]\([^\)]*\)", " ", cleaned)  # links
    # Replace common secrets patterns
    cleaned = re.sub(r"(?i)api[_-]?key\s*[:=]\s*\w+", "[REDACTED_API_KEY]", cleaned)
    cleaned = re.sub(r"(?i)secret\s*[:=]\s*\w+", "[REDACTED_SECRET]", cleaned)
    # Collapse excessive whitespace
    cleaned = " ".join(cleaned.split())
    return cleaned


def _checksum_text(text: str) -> str:
    return _sha256(text.encode("utf-8")).hexdigest()


def retire_record(db: Session, source_table: str, source_id: str) -> int:
    res = db.execute(text(
        """
        UPDATE rag_chunk
        SET is_deleted = TRUE
        WHERE source_table = :t AND source_id = :i AND is_deleted = FALSE
        """
    ), {"t": source_table, "i": source_id})
    db.commit()
    try:
        _set_status(db, source_table, source_id, error=None)
    except Exception:
        pass
    return res.rowcount or 0


def retire_missing_chunks(db: Session, source_table: str, source_id: str, version: int, planned: List[Tuple[str,int]]) -> int:
    # planned holds (field, part_index)
    if not planned:
        return 0
    placeholders = ",".join(["(:f{} , :p{} )".format(i, i) for i in range(len(planned))])
    params = {"t": source_table, "i": source_id, "v": version}
    for idx, (f, p) in enumerate(planned):
        params[f"f{idx}"] = f
        params[f"p{idx}"] = p
    res = db.execute(text(
        f"""
        UPDATE rag_chunk c
        SET is_deleted = TRUE
        WHERE c.source_table = :t AND c.source_id = :i AND c.version = :v
          AND (c.source_field, c.part_index) NOT IN (VALUES {placeholders})
        """
    ), params)
    db.commit()
    return res.rowcount or 0
def _set_status(db: Session, source_table: str, source_id: str, error: str | None) -> None:
    if error:
        db.execute(text(
            """
            INSERT INTO rag_index_status (source_table, source_id, last_error)
            VALUES (:t, :i, :e)
            ON CONFLICT (source_table, source_id)
            DO UPDATE SET last_error = EXCLUDED.last_error, updated_at = CURRENT_TIMESTAMP
            """
        ), {"t": source_table, "i": source_id, "e": error[:1000]})
    else:
        db.execute(text(
            """
            INSERT INTO rag_index_status (source_table, source_id, last_indexed_at, last_error)
            VALUES (:t, :i, CURRENT_TIMESTAMP, NULL)
            ON CONFLICT (source_table, source_id)
            DO UPDATE SET last_indexed_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP
            """
        ), {"t": source_table, "i": source_id})
    db.commit()



def _build_canonical_fields(record: Dict[str, any], source_table: str) -> Dict[str, str]:
    # Minimal canonical extractors per module; can be expanded
    fields: Dict[str, str] = {}
    if source_table == "categories":
        name = record.get("code") or ""
        descs = record.get("texts", [])
        desc_join = "\n\n".join(
            [f"{t.get('name','')}\n\n{t.get('description','')}" for t in descs]
        )
        fields["body"] = f"Category: {name}\n\n{desc_join}".strip()
    elif source_table == "projects":
        name = record.get("name") or record.get("id")
        desc = record.get("description") or ""
        fields["body"] = f"Project: {name}\n\n{desc}".strip()
        # include tags from categories and skills if present
        cats = record.get("categories") or []
        skills = record.get("skills") or []
        if cats:
            fields["tags"] = "Categories: " + ", ".join(sorted({c for c in cats if c}))
        if skills:
            fields.setdefault("tags", "")
            fields["tags"] = (fields["tags"] + ("\n" if fields["tags"] else "") + "Skills: " + ", ".join(sorted({s for s in skills if s}))).strip()
    elif source_table == "portfolios":
        fields["body"] = (record.get("name") or "").strip()
        desc = record.get("description")
        if desc:
            fields["body"] = (fields["body"] + ("\n\n" if fields["body"] else "") + desc).strip()
        # add tags
        parts: List[str] = []
        cats = record.get("categories") or []
        exps = record.get("experiences") or []
        secs = record.get("sections") or []
        if cats:
            parts.append("Categories: " + ", ".join(sorted({c for c in cats if c})))
        if exps:
            parts.append("Experiences: " + ", ".join(sorted({e for e in exps if e})))
        if secs:
            parts.append("Sections: " + ", ".join(sorted({s for s in secs if s})))
        if parts:
            fields["tags"] = "\n".join(parts)
    elif source_table in {"sections", "experiences", "skills", "skill_types", "category_types", "languages", "translations"}:
        # Simple join of common textual fields if present
        body_parts: List[str] = []
        for key in ("name", "code", "text", "description"):
            val = record.get(key)
            if isinstance(val, str) and val:
                body_parts.append(val)
        fields["body"] = "\n\n".join(body_parts)
    elif source_table in {"project_attachments", "portfolio_attachments"}:
        text_val = record.get("text") or ""
        fields["doc"] = text_val
    else:
        fields["body"] = " ".join([str(v) for v in record.values() if isinstance(v, str)])

    # Normalize HTML/Markdown content to plain text while preserving semantics
    for k, v in list(fields.items()):
        if not isinstance(v, str) or not v:
            continue
        if "<p" in v or "</" in v:
            # likely HTML
            if _html2text:
                try:
                    conv = _html2text.HTML2Text()
                    conv.ignore_images = True
                    conv.ignore_links = True
                    fields[k] = conv.handle(v)
                    continue
                except Exception:
                    pass
        if ("#" in v or "*" in v or "- " in v) and MarkdownIt:
            try:
                md = MarkdownIt()
                # convert to tokens then text; fallback to plain
                txt = md.render(v)
                fields[k] = re.sub(r"<[^>]+>", " ", txt)
            except Exception:
                pass
    return fields


def _load_current_state(db: Session, source_table: str, source_id: str) -> Dict[str, any]:
    # Lightweight loader using SQL; join to _texts tables where applicable
    if source_table == "categories":
        try:
            rec = db.execute(text("SELECT id, code, type_code, updated_at FROM categories WHERE id=:i"), {"i": source_id}).mappings().first()
            if not rec:
                return {}
            texts = db.execute(text(
                "SELECT name, description FROM category_texts WHERE category_id=:i ORDER BY id"
            ), {"i": source_id}).mappings().all()
            # Related skills (names)
            sks = db.execute(text(
                """
                SELECT st.name as name
                FROM category_skills cs
                JOIN skill_texts st ON st.skill_id = cs.skill_id
                WHERE cs.category_id = :i
                """
            ), {"i": source_id}).mappings().all()
            d = {"id": rec["id"], "code": rec["code"], "type_code": rec["type_code"], "updated_at": rec.get("updated_at"), "texts": [dict(t) for t in texts]}
            d["skills"] = [r["name"] for r in sks if r.get("name")]
            return d
        except Exception:
            return {"id": source_id, "code": str(source_id)}
    if source_table == "portfolios":
        try:
            rec = db.execute(text("SELECT id, name, description, updated_at FROM portfolios WHERE id=:i"), {"i": source_id}).mappings().first()
            if not rec:
                return {}
            cats = db.execute(text(
                """
                SELECT c.code FROM portfolio_categories pc
                JOIN categories c ON c.id = pc.category_id
                WHERE pc.portfolio_id = :i
                """
            ), {"i": source_id}).mappings().all()
            exps = db.execute(text(
                """
                SELECT e.code FROM portfolio_experiences pe
                JOIN experiences e ON e.id = pe.experience_id
                WHERE pe.portfolio_id = :i
                """
            ), {"i": source_id}).mappings().all()
            secs = db.execute(text(
                """
                SELECT s.code FROM portfolio_sections ps
                JOIN sections s ON s.id = ps.section_id
                WHERE ps.portfolio_id = :i
                """
            ), {"i": source_id}).mappings().all()
            d = dict(rec)
            d["categories"] = [r["code"] for r in cats]
            d["experiences"] = [r["code"] for r in exps]
            d["sections"] = [r["code"] for r in secs]
            return d
        except Exception:
            # Fallback for unit tests without domain tables
            return {"id": source_id, "name": "", "description": ""}
    if source_table == "projects":
        try:
            rec = db.execute(text("SELECT id, updated_at FROM projects WHERE id=:i"), {"i": source_id}).mappings().first()
            if not rec:
                return {}
            texts = db.execute(text(
                "SELECT name, description FROM project_texts WHERE project_id=:i ORDER BY id"
            ), {"i": source_id}).mappings().all()
            cats = db.execute(text(
                """
                SELECT c.code FROM project_categories pc
                JOIN categories c ON c.id = pc.category_id
                WHERE pc.project_id = :i
                """
            ), {"i": source_id}).mappings().all()
            sks = db.execute(text(
                """
                SELECT st.name as name
                FROM project_skills ps
                JOIN skill_texts st ON st.skill_id = ps.skill_id
                WHERE ps.project_id = :i
                """
            ), {"i": source_id}).mappings().all()
            d = {
                "id": rec["id"],
                "name": "\n".join([t["name"] or "" for t in texts]),
                "description": "\n\n".join([t["description"] or "" for t in texts]),
                "categories": [r["code"] for r in cats],
                "skills": [r["name"] for r in sks if r.get("name")],
            }
            if rec.get("updated_at"):
                d["updated_at"] = rec.get("updated_at")
            return d
        except Exception:
            return {"id": source_id, "name": "", "description": ""}
    if source_table == "sections":
        try:
            rec = db.execute(text("SELECT id, code, updated_at FROM sections WHERE id=:i"), {"i": source_id}).mappings().first()
            text_rows = db.execute(text("SELECT text FROM section_texts WHERE section_id=:i ORDER BY id"), {"i": source_id}).mappings().all()
            return {"id": rec["id"], "code": rec.get("code"), "text": "\n\n".join([r["text"] or "" for r in text_rows]), "updated_at": rec.get("updated_at")} if rec else {}
        except Exception:
            return {"id": source_id, "code": str(source_id), "text": ""}
    if source_table == "experiences":
        try:
            rec = db.execute(text("SELECT id, code, updated_at FROM experiences WHERE id=:i"), {"i": source_id}).mappings().first()
            text_rows = db.execute(text("SELECT name, description FROM experience_texts WHERE experience_id=:i ORDER BY id"), {"i": source_id}).mappings().all()
            return {"id": rec["id"], "code": rec.get("code"), "name": "\n".join([r["name"] or "" for r in text_rows]), "description": "\n\n".join([r["description"] or "" for r in text_rows]), "updated_at": rec.get("updated_at")} if rec else {}
        except Exception:
            return {"id": source_id, "code": str(source_id), "name": "", "description": ""}
    if source_table == "skills":
        try:
            rec = db.execute(text("SELECT id, type, updated_at FROM skills WHERE id=:i"), {"i": source_id}).mappings().first()
            text_rows = db.execute(text("SELECT name, description FROM skill_texts WHERE skill_id=:i ORDER BY id"), {"i": source_id}).mappings().all()
            return {"id": rec["id"], "type": rec.get("type"), "name": "\n".join([r["name"] or "" for r in text_rows]), "description": "\n\n".join([r["description"] or "" for r in text_rows]), "updated_at": rec.get("updated_at")} if rec else {}
        except Exception:
            return {"id": source_id, "type": "", "name": "", "description": ""}
    if source_table == "skill_types":
        try:
            rec = db.execute(text("SELECT code FROM skill_types WHERE code=:i"), {"i": source_id}).mappings().first()
            return dict(rec) if rec else {}
        except Exception:
            return {"code": str(source_id)}
    if source_table == "category_types":
        try:
            rec = db.execute(text("SELECT code, name, updated_at FROM category_types WHERE code=:i"), {"i": source_id}).mappings().first()
            return dict(rec) if rec else {}
        except Exception:
            return {"code": str(source_id)}
    if source_table == "languages":
        try:
            rec = db.execute(text("SELECT id, code, name, updated_at FROM languages WHERE id=:i"), {"i": source_id}).mappings().first()
            return dict(rec) if rec else {}
        except Exception:
            return {"id": source_id}
    if source_table == "translations":
        try:
            rec = db.execute(text("SELECT id, key, value, updated_at FROM translations WHERE id=:i"), {"i": source_id}).mappings().first()
            return dict(rec) if rec else {}
        except Exception:
            return {"id": source_id}
    # Attachments (project/portfolio)
    if source_table == "project_attachments":
        rec = db.execute(text("SELECT id, file_path, file_name FROM project_attachments WHERE id=:i"), {"i": source_id}).mappings().first()
        if not rec:
            return {}
        # Resolve full path via storage util in storage.py using uploads dir
        return {"id": rec["id"], "name": rec.get("file_name"), "text": extract_text_from_uri(rec.get("file_path") or "")}
    if source_table == "portfolio_attachments":
        rec = db.execute(text("SELECT id, file_path, file_name FROM portfolio_attachments WHERE id=:i"), {"i": source_id}).mappings().first()
        if not rec:
            return {}
        return {"id": rec["id"], "name": rec.get("file_name"), "text": extract_text_from_uri(rec.get("file_path") or "")}

    # Fallback: empty dict means treat as deleted
    return {}


def index_record(db: Session, source_table: str, source_id: str) -> None:
    try:
        # Load
        record = _load_current_state(db, source_table, source_id)
        if not record:
            retire_record(db, source_table, source_id)
            return

        # Build canonical fields
        fields = _build_canonical_fields(record, source_table)

        # Plan chunks and checksums
        plan: List[Tuple[str, int, str, str]] = []  # (field, part_index, text, checksum)
        # Redact/allowlist: if RAG_REDACT_REGEX is set, remove matches; if RAG_ALLOW_FIELDS is set, drop others
        allow_fields = set([f.strip() for f in os.getenv("RAG_ALLOW_FIELDS", "").split(",") if f.strip()])
        redact_re = os.getenv("RAG_REDACT_REGEX")
        for field, text_value in list(fields.items()):
            if allow_fields and field not in allow_fields:
                fields.pop(field)
                continue
            if redact_re:
                try:
                    text_value = re.sub(redact_re, "[REDACTED]", text_value)
                except Exception:
                    pass
            safe_text = _sanitize_text(text_value)
            for i, chunk in enumerate(chunk_text(safe_text)):
                safe_chunk = _sanitize_text(chunk)
                plan.append((field, i, safe_chunk, _checksum_text(safe_chunk)))

        # Versioning by minute bucket if updated_at is available; fallback to 1
        version = 1
        upd = record.get("updated_at")
        if isinstance(upd, datetime):
            version = int(upd.timestamp() // 60)

        # Upsert chunks and collect to-embed
        to_embed: List[Tuple[int, str]] = []
        planned_keys: List[Tuple[str, int]] = []
        default_tenant = os.getenv("DEFAULT_TENANT_ID", "default")
        default_visibility = os.getenv("DEFAULT_VISIBILITY", "public")
        new_count = 0
        upd_count = 0
        skip_count = 0
        # Determine expected embedding dimension for current provider/model (probe once)
        try:
            _probe_vec = embed_text_batch(["__dim_probe__"]) or [[]]
            expected_dim = len(_probe_vec[0]) if _probe_vec and _probe_vec[0] else 0
        except Exception:
            expected_dim = 0

        for field, i, chunk, cks in plan:
            planned_keys.append((field, i))
            # Check existing row to decide if embedding needed
            existing = db.execute(text(
                """
                SELECT id, checksum FROM rag_chunk
                WHERE source_table=:t AND source_id=:i AND source_field=:f AND part_index=:p AND version=:v
                """
            ), {"t": source_table, "i": source_id, "f": field, "p": i, "v": version}).mappings().first()

            needs_embed = False
            existing_id = None
            if not existing:
                needs_embed = True
                new_count += 1
            else:
                existing_id = existing["id"]
                if existing.get("checksum") != cks:
                    needs_embed = True
                    upd_count += 1
                else:
                    skip_count += 1

            row = db.execute(text(
                """
                INSERT INTO rag_chunk (source_table, source_id, source_field, part_index, version, modality, text, checksum, tenant_id, visibility)
                VALUES (:t, :i, :f, :p, :v, 'text', :tx, :ck, :tenant, :vis)
                ON CONFLICT (source_table, source_id, source_field, part_index, version)
                DO UPDATE SET text = EXCLUDED.text, checksum = EXCLUDED.checksum, is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP, tenant_id = EXCLUDED.tenant_id, visibility = EXCLUDED.visibility
                RETURNING id
                """
            ), {"t": source_table, "i": source_id, "f": field, "p": i, "v": version, "tx": chunk, "ck": cks, "tenant": default_tenant, "vis": default_visibility}).mappings().first()

            chunk_id = row["id"]
            # If checksum unchanged, ensure an embedding exists for current model with correct dimension; else mark for re-embed
            if not needs_embed and expected_dim:
                try:
                    emb_row = db.execute(text(
                        """
                        SELECT dim FROM rag_embedding
                        WHERE chunk_id = :cid AND model = :m AND modality = 'text'
                        """
                    ), {"cid": chunk_id, "m": os.getenv("EMBED_MODEL", "text-embedding-3-small")}).mappings().first()
                    if (not emb_row) or (int(emb_row.get("dim") or 0) != expected_dim):
                        needs_embed = True
                except Exception:
                    needs_embed = True

            if needs_embed:
                to_embed.append((chunk_id, chunk))

        # Embed and upsert vectors
        embedded_count = 0
        if to_embed:
            vectors = embed_text_batch([t for _, t in to_embed])
            if vectors:
                dim = len(vectors[0])
                for (chunk_id, _), vec in zip(to_embed, vectors):
                    # Store embedding both as text (for compatibility) and as vector (for HNSW index)
                    db.execute(text(
                        """
                        INSERT INTO rag_embedding (chunk_id, model, modality, dim, embedding, embedding_vec)
                        VALUES (:cid, :m, 'text', :d, :e, CAST(:e AS vector))
                        ON CONFLICT (chunk_id, model, modality)
                        DO UPDATE SET embedding = EXCLUDED.embedding, embedding_vec = EXCLUDED.embedding_vec, dim = EXCLUDED.dim
                        """
                    ), {"cid": chunk_id, "m": os.getenv("EMBED_MODEL", "text-embedding-3-small"), "d": dim, "e": f"[{', '.join(str(x) for x in vec)}]"})
                    embedded_count += 1
                    if rag_embeddings_upserted:
                        try:
                            rag_embeddings_upserted.inc()
                        except Exception:
                            pass

        # Retire missing
        retired = retire_missing_chunks(db, source_table, source_id, version, [(f, p) for f, p, _, _ in plan])
        if rag_chunks_retired and retired:
            try:
                rag_chunks_retired.inc(retired)
            except Exception:
                pass
        # Emit counters for new/updated/skipped
        try:
            if rag_chunks_new and new_count:
                rag_chunks_new.inc(new_count)
            if rag_chunks_updated and upd_count:
                rag_chunks_updated.inc(upd_count)
            if rag_chunks_skipped and skip_count:
                rag_chunks_skipped.inc(skip_count)
        except Exception:
            pass
        # Retire all chunks from other versions
        try:
            db.execute(text(
                """
                UPDATE rag_chunk SET is_deleted=TRUE
                WHERE source_table=:t AND source_id=:i AND version<>:v AND is_deleted=FALSE
                """
            ), {"t": source_table, "i": source_id, "v": version})
            db.commit()
        except Exception:
            pass
        try:
            logger.info(f"indexed={len(plan)} to_embed={len(to_embed)} embedded={embedded_count} retired={retired} table={source_table} id={source_id}")
        except Exception:
            pass
        try:
            _set_status(db, source_table, source_id, error=None)
        except Exception:
            pass
    except Exception as e:
        try:
            _set_status(db, source_table, source_id, error=str(e))
        except Exception:
            pass
        raise

