import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.kafka_prod import publish_event

router = APIRouter()


def _increment_profile_connections(member_id: str) -> None:
    primary = settings.profile_service_url.rstrip("/")
    bases = [primary]
    fallback = "http://host.docker.internal:8002"
    if fallback.rstrip("/") != primary:
        bases.append(fallback)
    for base in bases:
        url = f"{base}/api/members/{member_id}/increment-connections"
        try:
            with httpx.Client(timeout=10.0) as client:
                r = client.post(url)
                if r.status_code != 200:
                    print(f"increment-connections HTTP {r.status_code} for {member_id} @ {base}: {r.text[:300]}")
                    continue
                body = r.json()
                if body.get("success"):
                    return
                print(f"increment-connections profile refused for {member_id} @ {base}: {body}")
        except httpx.RequestError as e:
            print(f"increment-connections unreachable {url}: {e}")
            continue
        except Exception as e:
            print(f"increment-connections error for {member_id} @ {base}: {e}")


def _new_connection_id() -> str:
    return "CON" + uuid.uuid4().hex[:8].upper()


@router.post("/request")
def request_connection(body: dict[str, Any] = Body(default_factory=dict), db: Session = Depends(get_db)):
    requester_id = body.get("requester_id")
    receiver_id = body.get("receiver_id")
    if not requester_id or not receiver_id:
        return {"success": False, "message": "requester_id and receiver_id are required"}
    if requester_id == receiver_id:
        return {"success": False, "message": "Cannot send connection request to yourself"}

    rows = db.execute(
        text(
            """SELECT * FROM connections
               WHERE (requester_id = :a AND receiver_id = :b)
                  OR (requester_id = :b AND receiver_id = :a)"""
        ),
        {"a": requester_id, "b": receiver_id},
    ).fetchall()

    connection_id = _new_connection_id()

    if rows:
        conn_row = dict(rows[0]._mapping)
        st = conn_row["status"]
        if st == "accepted":
            return JSONResponse(
                status_code=409,
                content={"success": False, "message": "You are already connected with this user"},
            )
        if st == "pending":
            return JSONResponse(
                status_code=409,
                content={
                    "success": False,
                    "message": "A connection request already exists between these users",
                    "connection_id": conn_row["connection_id"],
                    "status": st,
                },
            )
        if st == "rejected":
            db.execute(
                text(
                    """UPDATE connections SET status = 'pending', requester_id = :rid, receiver_id = :rcv,
                       connection_id = :cid, updated_at = NOW() WHERE id = :id"""
                ),
                {
                    "rid": requester_id,
                    "rcv": receiver_id,
                    "cid": connection_id,
                    "id": conn_row["id"],
                },
            )
            db.commit()
            publish_event(
                "connection.requested",
                requester_id,
                "connection",
                connection_id,
                {
                    "connection_id": connection_id,
                    "requester_id": requester_id,
                    "receiver_id": receiver_id,
                    "status": "pending",
                },
            )
            return JSONResponse(
                status_code=201,
                content={
                    "success": True,
                    "message": "Connection request re-sent successfully",
                    "data": {
                        "connection_id": connection_id,
                        "requester_id": requester_id,
                        "receiver_id": receiver_id,
                        "status": "pending",
                    },
                },
            )

    try:
        db.execute(
            text(
                """INSERT INTO connections (connection_id, requester_id, receiver_id, status)
                   VALUES (:cid, :rid, :rcv, 'pending')"""
            ),
            {"cid": connection_id, "rid": requester_id, "rcv": receiver_id},
        )
        db.commit()
    except Exception as e:
        db.rollback()
        err = str(e).lower()
        if "duplicate" in err or "1062" in err:
            return JSONResponse(
                status_code=409,
                content={"success": False, "message": "Duplicate connection request"},
            )
        raise

    publish_event(
        "connection.requested",
        requester_id,
        "connection",
        connection_id,
        {
            "connection_id": connection_id,
            "requester_id": requester_id,
            "receiver_id": receiver_id,
            "status": "pending",
        },
    )
    return JSONResponse(
        status_code=201,
        content={
            "success": True,
            "message": "Connection request sent successfully",
            "data": {
                "connection_id": connection_id,
                "requester_id": requester_id,
                "receiver_id": receiver_id,
                "status": "pending",
            },
        },
    )


@router.post("/accept")
def accept(body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    connection_id = body.get("connection_id")
    if not connection_id:
        return {"success": False, "message": "connection_id is required"}

    rows = db.execute(
        text("SELECT * FROM connections WHERE connection_id = :c"),
        {"c": connection_id},
    ).fetchall()
    if not rows:
        return {"success": False, "message": "Connection request not found"}
    conn_row = dict(rows[0]._mapping)
    if conn_row["status"] == "accepted":
        return {"success": False, "message": "Connection already accepted"}
    if conn_row["status"] != "pending":
        return {"success": False, "message": f"Cannot accept a connection with status: {conn_row['status']}"}

    db.execute(
        text("UPDATE connections SET status = 'accepted', updated_at = NOW() WHERE connection_id = :c"),
        {"c": connection_id},
    )
    db.commit()
    _increment_profile_connections(conn_row["requester_id"])
    _increment_profile_connections(conn_row["receiver_id"])
    try:
        publish_event(
            "connection.accepted",
            conn_row["receiver_id"],
            "connection",
            connection_id,
            {
                "connection_id": connection_id,
                "requester_id": conn_row["requester_id"],
                "receiver_id": conn_row["receiver_id"],
                "status": "accepted",
            },
        )
    except Exception as e:
        print(f"connection.accepted Kafka publish failed: {e}")

    return {
        "success": True,
        "message": "Connection accepted successfully",
        "data": {
            "connection_id": connection_id,
            "requester_id": conn_row["requester_id"],
            "receiver_id": conn_row["receiver_id"],
            "status": "accepted",
        },
    }


@router.post("/reject")
def reject(body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    connection_id = body.get("connection_id")
    if not connection_id:
        return {"success": False, "message": "connection_id is required"}
    rows = db.execute(
        text("SELECT * FROM connections WHERE connection_id = :c"),
        {"c": connection_id},
    ).fetchall()
    if not rows:
        return {"success": False, "message": "Connection request not found"}
    conn_row = dict(rows[0]._mapping)
    if conn_row["status"] != "pending":
        return {"success": False, "message": f"Cannot reject a connection with status: {conn_row['status']}"}
    db.execute(
        text("UPDATE connections SET status = 'rejected', updated_at = NOW() WHERE connection_id = :c"),
        {"c": connection_id},
    )
    db.commit()
    return {
        "success": True,
        "message": "Connection request rejected",
        "data": {
            "connection_id": connection_id,
            "requester_id": conn_row["requester_id"],
            "receiver_id": conn_row["receiver_id"],
            "status": "rejected",
        },
    }


@router.post("/list")
def list_connections(body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    status_f = body.get("status")
    if not user_id:
        return {"success": False, "message": "user_id is required"}
    q = "SELECT * FROM connections WHERE (requester_id = :u OR receiver_id = :u)"
    params: dict[str, Any] = {"u": user_id}
    if status_f:
        q += " AND status = :st"
        params["st"] = status_f
    q += " ORDER BY updated_at DESC"
    rows = db.execute(text(q), params).fetchall()
    connections = []
    for row in rows:
        r = dict(row._mapping)
        uid = user_id
        connections.append(
            {
                "connection_id": r["connection_id"],
                "requester_id": r["requester_id"],
                "receiver_id": r["receiver_id"],
                "status": r["status"],
                "direction": "sent" if r["requester_id"] == uid else "received",
                "connected_user_id": r["receiver_id"] if r["requester_id"] == uid else r["requester_id"],
                "created_at": str(r["created_at"]),
                "updated_at": str(r["updated_at"]),
            }
        )
    return {"success": True, "user_id": user_id, "total_connections": len(connections), "connections": connections}


@router.post("/mutual")
def mutual(body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    u1 = body.get("user_id_1")
    u2 = body.get("user_id_2")
    if not u1 or not u2:
        return {"success": False, "message": "user_id_1 and user_id_2 are required"}

    r1 = db.execute(
        text(
            """SELECT CASE WHEN requester_id = :u THEN receiver_id ELSE requester_id END AS connected_user
               FROM connections WHERE (requester_id = :u OR receiver_id = :u) AND status = 'accepted'"""
        ),
        {"u": u1},
    ).fetchall()
    r2 = db.execute(
        text(
            """SELECT CASE WHEN requester_id = :u THEN receiver_id ELSE requester_id END AS connected_user
               FROM connections WHERE (requester_id = :u OR receiver_id = :u) AND status = 'accepted'"""
        ),
        {"u": u2},
    ).fetchall()
    s1 = {dict(x._mapping)["connected_user"] for x in r1}
    s2 = {dict(x._mapping)["connected_user"] for x in r2}
    mutual_ids = list(s1 & s2)
    return {"success": True, "user_id_1": u1, "user_id_2": u2, "mutual_count": len(mutual_ids), "mutual_connections": mutual_ids}


@router.get("/health")
def health():
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {"status": "ok", "service": "connection-service", "timestamp": ts}
