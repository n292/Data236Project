from __future__ import annotations

import hashlib
import json
import math
import re
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cache import redis_cache as cache
from app.core.exceptions import JobServiceError
from app.kafka import producer as kafka_producer

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.I,
)


def is_uuid(v: Any) -> bool:
    return isinstance(v, str) and bool(UUID_RE.match(v))


def is_job_id_lookup(v: Any) -> bool:
    """True for strict UUIDs or legacy ids stored in job_postings.job_id (e.g. job-c0c9df0e, recruiter-nnn)."""
    if not isinstance(v, str):
        return False
    s = v.strip()
    if not s or len(s) > 64:
        return False
    if is_uuid(s):
        return True
    return bool(re.match(r"^[a-zA-Z0-9._-]+$", s))


def is_nonempty(v: Any) -> bool:
    return isinstance(v, str) and len(v.strip()) > 0


def company_id_from_name(name: str) -> str:
    h = hashlib.sha256(str(name).lower().strip().encode()).hexdigest()
    return (
        f"{h[0:8]}-{h[8:12]}-"
        f"4{h[13:16]}-"
        f"{(int(h[16], 16) % 4 + 8):x}{h[17:20]}-"
        f"{h[20:32]}"
    )


def parse_json_array(skills: Any) -> list:
    if skills is None:
        return []
    if isinstance(skills, list):
        return skills
    if isinstance(skills, str):
        try:
            p = json.loads(skills)
            return p if isinstance(p, list) else []
        except json.JSONDecodeError:
            return []
    return []


def map_row(row) -> dict[str, Any]:
    if row is None:
        return {}
    d = dict(row._mapping) if hasattr(row, "_mapping") else dict(row)
    skills = d.get("skills_required")
    if isinstance(skills, str):
        try:
            skills = json.loads(skills)
        except json.JSONDecodeError:
            skills = []
    if not isinstance(skills, list):
        skills = []
    sal_min, sal_max = d.get("salary_min"), d.get("salary_max")
    salary_range = None
    if sal_min is not None or sal_max is not None:
        salary_range = {"min": sal_min, "max": sal_max}
    jid = d.get("job_id")
    if isinstance(jid, bytes):
        jid = jid.decode("utf-8", errors="replace")
    elif jid is not None:
        jid = str(jid).strip()
    return {
        "job_id": jid,
        "company_id": d.get("company_id"),
        "company_name": d.get("company_name"),
        "recruiter_id": d.get("recruiter_id"),
        "title": d.get("title"),
        "description": d.get("description"),
        "seniority_level": d.get("seniority_level"),
        "employment_type": d.get("employment_type"),
        "location": d.get("location"),
        "industry": d.get("industry"),
        "remote": d.get("remote"),
        "skills_required": skills,
        "salary_range": salary_range,
        "posted_datetime": d.get("posted_datetime"),
        "status": d.get("status"),
        "views_count": d.get("views_count"),
        "applicants_count": d.get("applicants_count"),
    }


def normalize_remote(v: Any) -> str | None:
    if v is None:
        return "onsite"
    s = str(v).lower()
    if s in ("remote", "hybrid", "onsite"):
        return s
    return None


def normalize_salary_range(body: dict) -> tuple[float | None, float | None]:
    min_v = body.get("salary_min")
    max_v = body.get("salary_max")
    r = body.get("salary_range")
    if isinstance(r, dict):
        if r.get("min") is not None:
            min_v = r["min"]
        if r.get("max") is not None:
            max_v = r["max"]
    try:
        n_min = float(min_v) if min_v not in (None, "") else None
    except (TypeError, ValueError):
        n_min = None
    try:
        n_max = float(max_v) if max_v not in (None, "") else None
        if n_max is not None and not math.isfinite(n_max):
            n_max = None
    except (TypeError, ValueError):
        n_max = None
    if n_min is not None and not math.isfinite(n_min):
        n_min = None
    return n_min, n_max


def create_job(db: Session, body: dict, *, trace_id: str | None = None) -> dict:
    title = (body.get("title") or "").strip()
    company_id = body.get("company_id")
    recruiter_id = body.get("recruiter_id")
    location = (body.get("location") or "").strip()
    employment_type = (body.get("employment_type") or "").strip()

    errors: list[str] = []
    if not title:
        errors.append("title is required")
    if not company_id:
        errors.append("company_id is required (or pass company_name)")
    elif not is_uuid(str(company_id)):
        errors.append("company_id must be a UUID")
    if not is_nonempty(recruiter_id):
        errors.append("recruiter_id is required")
    if not location:
        errors.append("location is required")
    if not employment_type:
        errors.append("employment_type is required")

    remote = normalize_remote(body.get("remote"))
    if body.get("remote") is not None and remote is None:
        errors.append("remote must be onsite, remote, or hybrid")

    if errors:
        raise JobServiceError("VALIDATION", errors)

    dup = db.execute(
        text(
            """SELECT job_id FROM job_postings
               WHERE title = :t AND company_id = :c AND recruiter_id = :r AND status = 'open' LIMIT 1"""
        ),
        {"t": title, "c": company_id, "r": recruiter_id},
    ).first()
    if dup:
        raise JobServiceError("DUPLICATE_JOB")

    job_id = str(uuid.uuid4())
    salary_min, salary_max = normalize_salary_range(body)
    skills_json = json.dumps(parse_json_array(body.get("skills_required")))
    sen = body.get("seniority_level")
    seniority = str(sen)[:64] if sen is not None else None
    desc = str(body["description"]) if body.get("description") is not None else None
    ind = body.get("industry")
    industry = str(ind)[:128] if ind is not None else None
    cn = body.get("company_name")
    company_name = str(cn)[:255] if cn else None

    db.execute(
        text(
            """INSERT INTO job_postings (
              job_id, company_id, company_name, recruiter_id, title, description, seniority_level,
              employment_type, location, industry, remote, skills_required, salary_min, salary_max,
              posted_datetime, status, views_count, applicants_count
            ) VALUES (
              :job_id, :company_id, :company_name, :recruiter_id, :title, :description, :seniority_level,
              :employment_type, :location, :industry, :remote, :skills_required, :salary_min, :salary_max,
              NOW(), 'open', 0, 0
            )"""
        ),
        {
            "job_id": job_id,
            "company_id": company_id,
            "company_name": company_name,
            "recruiter_id": recruiter_id,
            "title": title[:255],
            "description": desc,
            "seniority_level": seniority,
            "employment_type": employment_type[:64],
            "location": location[:255],
            "industry": industry,
            "remote": remote,
            "skills_required": skills_json,
            "salary_min": salary_min,
            "salary_max": salary_max,
        },
    )
    db.commit()

    cache.invalidate_all_search_cache()

    tid = trace_id
    if tid and not is_uuid(tid):
        tid = None
    if not tid:
        tid = str(uuid.uuid4())

    kafka_producer.send_job_created(
        job_id=job_id,
        title=title[:255],
        company_id=str(company_id),
        recruiter_id=str(recruiter_id),
        location=location[:255],
        employment_type=employment_type[:64],
        trace_id=tid,
    )

    return {"job_id": job_id, "status": "open"}


def get_job(db: Session, body: dict) -> dict:
    raw = body.get("job_id")
    job_id = str(raw).strip() if raw is not None else ""
    if not job_id or not is_job_id_lookup(job_id):
        raise JobServiceError("VALIDATION", ["job_id is invalid"])

    cached = cache.get_job_cache(job_id)
    if cached:
        return cached

    row = db.execute(
        text("SELECT * FROM job_postings WHERE job_id = :jid LIMIT 1"),
        {"jid": job_id},
    ).first()
    if not row:
        raise JobServiceError("NOT_FOUND")

    mapped = map_row(row)
    if mapped.get("status") != "closed":
        cache.set_job_cache(job_id, mapped)
    return mapped


def update_job(db: Session, body: dict) -> dict:
    job_id = body.get("job_id")
    recruiter_id = body.get("recruiter_id")
    if not job_id or not is_uuid(job_id):
        raise JobServiceError("VALIDATION", ["job_id must be a UUID"])
    if not is_nonempty(recruiter_id):
        raise JobServiceError("VALIDATION", ["recruiter_id is required"])

    row = db.execute(
        text("SELECT * FROM job_postings WHERE job_id = :jid LIMIT 1"),
        {"jid": job_id},
    ).first()
    if not row:
        raise JobServiceError("NOT_FOUND")
    current = dict(row._mapping)
    if current["recruiter_id"] != recruiter_id:
        raise JobServiceError("FORBIDDEN")

    source = body.get("fields_to_update") if isinstance(body.get("fields_to_update"), dict) else body

    sets: list[str] = []
    params: dict[str, Any] = {"job_id": job_id}

    def add_set(col: str, val_key: str, sql_expr: str = None):
        expr = sql_expr or f"{col} = :{val_key}"
        sets.append(expr)

    if source.get("title") is not None and source["title"] != current["title"]:
        add_set("title", "u_title")
        params["u_title"] = str(source["title"]).strip()[:255]
    if source.get("description") is not None and source["description"] != current["description"]:
        add_set("description", "u_desc")
        params["u_desc"] = None if source["description"] is None else str(source["description"])
    if source.get("seniority_level") is not None and source["seniority_level"] != current["seniority_level"]:
        add_set("seniority_level", "u_sen")
        params["u_sen"] = (
            None if source["seniority_level"] is None else str(source["seniority_level"])[:64]
        )
    if source.get("employment_type") is not None and source["employment_type"] != current["employment_type"]:
        add_set("employment_type", "u_et")
        params["u_et"] = str(source["employment_type"])[:64]
    if source.get("location") is not None and source["location"] != current["location"]:
        add_set("location", "u_loc")
        params["u_loc"] = str(source["location"]).strip()[:255]
    if source.get("industry") is not None and source["industry"] != current["industry"]:
        add_set("industry", "u_ind")
        params["u_ind"] = None if source["industry"] is None else str(source["industry"])[:128]
    if source.get("remote") is not None:
        nr = normalize_remote(source["remote"])
        if nr is None:
            raise JobServiceError("VALIDATION", ["remote must be onsite, remote, or hybrid"])
        if nr != current["remote"]:
            add_set("remote", "u_remote")
            params["u_remote"] = nr
    if source.get("skills_required") is not None:
        next_sk = json.dumps(parse_json_array(source["skills_required"]))
        cur_sk = current["skills_required"]
        if isinstance(cur_sk, str):
            cur_cmp = cur_sk
        else:
            cur_cmp = json.dumps(cur_sk or [])
        if next_sk != cur_cmp:
            add_set("skills_required", "u_skills")
            params["u_skills"] = next_sk

    merged = {**body, **source}
    next_min, next_max = normalize_salary_range(merged)
    cur_min = (
        float(current["salary_min"])
        if current.get("salary_min") not in (None, "")
        else None
    )
    cur_max = (
        float(current["salary_max"])
        if current.get("salary_max") not in (None, "")
        else None
    )
    if (
        source.get("salary_range") is not None
        or source.get("salary_min") is not None
        or source.get("salary_max") is not None
    ):
        if next_min != cur_min:
            add_set("salary_min", "u_smin")
            params["u_smin"] = next_min
        if next_max != cur_max:
            add_set("salary_max", "u_smax")
            params["u_smax"] = next_max

    if not sets:
        db.commit()
        return map_row(row)

    sql = f"UPDATE job_postings SET {', '.join(sets)} WHERE job_id = :job_id"
    db.execute(text(sql), params)
    cache.invalidate_job_cache(job_id)
    cache.invalidate_all_search_cache()
    db.commit()

    row2 = db.execute(
        text("SELECT * FROM job_postings WHERE job_id = :jid LIMIT 1"),
        {"jid": job_id},
    ).first()
    return map_row(row2)


def close_job(db: Session, body: dict) -> dict:
    job_id = body.get("job_id")
    recruiter_id = body.get("recruiter_id")
    if not job_id or not is_uuid(job_id):
        raise JobServiceError("VALIDATION", ["job_id must be a UUID"])
    if not is_nonempty(recruiter_id):
        raise JobServiceError("VALIDATION", ["recruiter_id is required"])

    row = db.execute(
        text("SELECT * FROM job_postings WHERE job_id = :jid LIMIT 1"),
        {"jid": job_id},
    ).first()
    if not row:
        raise JobServiceError("NOT_FOUND")
    r = dict(row._mapping)
    if r["recruiter_id"] != recruiter_id:
        raise JobServiceError("FORBIDDEN")
    if r["status"] == "closed":
        raise JobServiceError("ALREADY_CLOSED")

    db.execute(
        text(
            "UPDATE job_postings SET status = 'closed' WHERE job_id = :jid AND recruiter_id = :rid"
        ),
        {"jid": job_id, "rid": recruiter_id},
    )
    cache.invalidate_job_cache(job_id)
    cache.invalidate_all_search_cache()
    db.commit()

    tid = body.get("trace_id")
    if tid and not is_uuid(str(tid)):
        tid = None
    if not tid:
        tid = str(uuid.uuid4())
    kafka_producer.send_job_closed(
        job_id=job_id,
        recruiter_id=str(recruiter_id),
        company_id=r.get("company_id"),
        trace_id=str(tid),
    )
    return {"status": "closed"}


def view_job(db: Session, body: dict) -> dict:
    job_id = body.get("job_id")
    viewer_id = body.get("viewer_id")
    if not job_id or not is_uuid(job_id):
        raise JobServiceError("VALIDATION", ["job_id must be a UUID"])
    if not viewer_id or not is_uuid(str(viewer_id)):
        raise JobServiceError("VALIDATION", ["viewer_id must be a UUID"])

    exists = db.execute(
        text("SELECT job_id FROM job_postings WHERE job_id = :jid LIMIT 1"),
        {"jid": job_id},
    ).first()
    if not exists:
        raise JobServiceError("NOT_FOUND")

    tid = body.get("trace_id")
    if tid and not is_uuid(str(tid)):
        tid = None
    if not tid:
        tid = str(uuid.uuid4())
    kafka_producer.send_job_viewed(job_id=job_id, viewer_id=str(viewer_id), trace_id=str(tid))
    return {"status": "viewed"}


def save_job(db: Session, body: dict) -> dict:
    job_id = body.get("job_id")
    user_id = body.get("user_id")
    if not job_id or not isinstance(job_id, str):
        raise JobServiceError("VALIDATION", ["job_id is required"])
    if not user_id or not isinstance(user_id, str):
        raise JobServiceError("VALIDATION", ["user_id is required"])

    exists = db.execute(
        text("SELECT job_id FROM job_postings WHERE job_id = :jid LIMIT 1"),
        {"jid": job_id},
    ).first()
    if not exists:
        raise JobServiceError("NOT_FOUND")

    db.execute(
        text(
            """INSERT INTO saved_jobs (user_id, job_id, saved_at) VALUES (:u, :j, NOW())
               ON DUPLICATE KEY UPDATE saved_at = NOW()"""
        ),
        {"u": user_id, "j": job_id},
    )
    db.commit()

    tid = body.get("trace_id")
    if tid and not is_uuid(str(tid)):
        tid = None
    if not tid:
        tid = str(uuid.uuid4())
    sm = body.get("session_meta") if isinstance(body.get("session_meta"), dict) else {}
    kafka_producer.send_job_saved(job_id=job_id, user_id=user_id, trace_id=str(tid), session_meta=sm)
    return {"status": "saved"}


def unsave_job(db: Session, body: dict) -> dict:
    job_id = body.get("job_id")
    user_id = body.get("user_id")
    if not job_id or not user_id:
        raise JobServiceError("VALIDATION", ["job_id and user_id are required"])
    db.execute(
        text("DELETE FROM saved_jobs WHERE user_id = :u AND job_id = :j"),
        {"u": user_id, "j": job_id},
    )
    db.commit()
    kafka_producer.send_job_unsaved(
        job_id=str(job_id), user_id=str(user_id), trace_id=str(uuid.uuid4())
    )
    return {"status": "unsaved"}


def get_saved_jobs(db: Session, body: dict) -> dict:
    user_id = body.get("user_id")
    if not user_id or not isinstance(user_id, str):
        raise JobServiceError("VALIDATION", ["user_id is required"])
    rows = db.execute(
        text(
            """SELECT jp.* FROM job_postings jp
               INNER JOIN saved_jobs sj ON jp.job_id = sj.job_id
               WHERE sj.user_id = :uid
               ORDER BY sj.saved_at DESC"""
        ),
        {"uid": user_id},
    ).fetchall()
    return {"jobs": [map_row(r) for r in rows]}


def non_empty_list(input_val: Any, limit: int = 100) -> list[str]:
    if isinstance(input_val, list):
        return [str(v).strip() for v in input_val if str(v).strip()][:limit]
    if input_val is None:
        return []
    one = str(input_val).strip()
    return [one] if one else []


def search_jobs(db: Session, body: dict) -> dict:
    page = int(body.get("page", 0))
    limit = int(body.get("limit", 0))
    if not isinstance(page, int) or page < 1:
        raise JobServiceError("VALIDATION", ["page must be a positive integer"])
    if not isinstance(limit, int) or limit < 1 or limit > 100:
        raise JobServiceError("VALIDATION", ["limit must be an integer between 1 and 100"])

    cache_payload = {
        "page": page,
        "limit": limit,
        "keyword": body.get("keyword"),
        "location": body.get("location"),
        "employment_type": body.get("employment_type"),
        "remote": body.get("remote"),
        "industry": body.get("industry"),
        "seniority_level": body.get("seniority_level"),
        "company": body.get("company"),
    }
    cached = cache.get_search_cache(cache_payload)
    if cached:
        return cached

    where = ["status = 'open'"]
    params: list[Any] = []

    kw = str(body.get("keyword") or "").strip()
    kw_parts: list[str] = []
    if kw:
        for w in kw.split():
            w = re.sub(r"[^\w]", "", w)
            if w:
                kw_parts.append(w)
    long_words = [w for w in kw_parts if len(w) >= 3]
    short_words = [w for w in kw_parts if 0 < len(w) < 3]
    bool_query = None
    if long_words:
        bool_query = " ".join(f"+{p}*" for p in long_words[:8])

    order_by = "posted_datetime DESC"
    if kw:
        like_pct = f"%{kw}%"
        if bool_query:
            where.append(
                "(title LIKE %s OR company_name LIKE %s OR MATCH(title, description, company_name) AGAINST (%s IN BOOLEAN MODE))"
            )
            params.extend([like_pct, like_pct, bool_query])
            for sw in short_words[:4]:
                sw_pct = f"%{sw}%"
                where.append("(title LIKE %s OR skills_required LIKE %s OR description LIKE %s)")
                params.extend([sw_pct, sw_pct, sw_pct])
            order_by = "(title LIKE %s) DESC, MATCH(title, description, company_name) AGAINST (%s IN BOOLEAN MODE) DESC, posted_datetime DESC"
        else:
            where.append("(title LIKE %s OR company_name LIKE %s OR description LIKE %s)")
            params.extend([like_pct, like_pct, like_pct])
            order_by = "(title LIKE %s) DESC, posted_datetime DESC"

    if body.get("company") is not None and str(body.get("company")).strip():
        where.append("company_name LIKE %s")
        params.append(f"%{str(body['company']).strip()}%")

    if body.get("location") is not None and str(body.get("location")).strip():
        where.append("location LIKE %s")
        params.append(f"%{str(body['location']).strip()}%")

    employment_types = non_empty_list(body.get("employment_type"), 10)
    if employment_types:
        placeholders = ", ".join(["LOWER(%s)"] * len(employment_types))
        where.append(f"LOWER(employment_type) IN ({placeholders})")
        params.extend(employment_types)

    remote_modes = non_empty_list(body.get("remote"), 10)
    if remote_modes:
        normalized = [normalize_remote(v) for v in remote_modes]
        if any(v is None for v in normalized):
            raise JobServiceError("VALIDATION", ["remote must be onsite, remote, or hybrid"])
        placeholders = ", ".join(["%s"] * len(normalized))
        where.append(f"remote IN ({placeholders})")
        params.extend(normalized)

    industry_list = non_empty_list(body.get("industry"), 20)
    if industry_list:
        placeholders = ", ".join(["%s"] * len(industry_list))
        where.append(f"industry IN ({placeholders})")
        params.extend(industry_list)

    if body.get("days_since") is not None:
        try:
            days = abs(int(body["days_since"]))
            if days > 0:
                where.append("posted_datetime >= DATE_SUB(NOW(), INTERVAL %s DAY)")
                params.append(days)
        except (TypeError, ValueError):
            pass

    seniority_levels = non_empty_list(body.get("seniority_level"), 10)
    if seniority_levels:
        placeholders = ", ".join(["LOWER(%s)"] * len(seniority_levels))
        where.append(f"LOWER(seniority_level) IN ({placeholders})")
        params.extend(seniority_levels)

    where_sql = " AND ".join(where) if where else "1=1"
    offset = (page - 1) * limit

    order_params: list[Any] = []
    if kw:
        like_pct = f"%{kw}%"
        if bool_query:
            order_params = [like_pct, bool_query]
        else:
            order_params = [like_pct]

    conn = db.connection().connection
    cur = conn.cursor()
    count_sql = f"SELECT COUNT(*) AS c FROM job_postings WHERE {where_sql}"
    cur.execute(count_sql, tuple(params))
    total = cur.fetchone()[0]

    list_sql = f"SELECT * FROM job_postings WHERE {where_sql} ORDER BY {order_by} LIMIT %s OFFSET %s"
    list_params = tuple(params + order_params + [limit, offset])
    cur.execute(list_sql, list_params)
    cols = [d[0] for d in cur.description]
    list_rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    cur.close()

    result = {"jobs": [_map_dict_row(r) for r in list_rows], "total": total, "page": page}
    cache.set_search_cache(cache_payload, result)
    db.commit()
    return result


def _map_dict_row(d: dict) -> dict:
    return map_row(type("R", (), {"_mapping": d})())


def jobs_by_recruiter(db: Session, body: dict) -> dict:
    recruiter_id = body.get("recruiter_id")
    if not is_nonempty(recruiter_id):
        raise JobServiceError("VALIDATION", ["recruiter_id is required"])

    page = int(body.get("page") or 1)
    limit = int(body.get("limit") or 20)
    if page < 1:
        raise JobServiceError("VALIDATION", ["page must be a positive integer"])
    if limit < 1 or limit > 100:
        raise JobServiceError("VALIDATION", ["limit must be an integer between 1 and 100"])

    params_list: list[Any] = [recruiter_id]
    status_clause = ""
    if body.get("status") is not None and str(body.get("status")).strip():
        s = str(body["status"]).strip().lower()
        if s not in ("open", "closed"):
            raise JobServiceError("VALIDATION", ["status must be open or closed"])
        status_clause = " AND status = %s"
        params_list.append(s)

    where_sql = f"recruiter_id = %s{status_clause}"
    offset = (page - 1) * limit

    conn = db.connection().connection
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) AS c FROM job_postings WHERE {where_sql}", tuple(params_list))
    total = cur.fetchone()[0]
    cur.execute(
        f"SELECT * FROM job_postings WHERE {where_sql} ORDER BY posted_datetime DESC LIMIT %s OFFSET %s",
        tuple(params_list + [limit, offset]),
    )
    cols = [d[0] for d in cur.description]
    list_rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    cur.close()
    db.commit()
    return {"jobs": [_map_dict_row(r) for r in list_rows], "total": total}


# Fix search_jobs: remove broken _bind_params path — already using raw cursor for count/list
