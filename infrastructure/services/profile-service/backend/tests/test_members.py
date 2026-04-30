"""Unit + integration tests for the Profile Service member endpoints."""
from uuid import uuid4
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app

client = TestClient(app)

BASE_PAYLOAD = {
    "first_name": "Test",
    "last_name": "User",
    "headline": "Software Engineer",
    "city": "San Francisco",
    "state": "CA",
    "country": "US",
    "skills": ["Python", "FastAPI"],
}


def create_member(email=None):
    if email is None:
        email = f"test_{uuid4().hex[:12]}@example.com"
    payload = {**BASE_PAYLOAD, "email": email}
    return client.post("/api/members/create", json=payload)


# ── create ────────────────────────────────────────────────────────────────────

class TestCreateMember:
    def test_create_success(self):
        r = create_member()
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["member_id"] is not None

    def test_create_duplicate_email(self):
        email = f"dup_{uuid4().hex[:8]}@example.com"
        r1 = create_member(email)
        assert r1.json()["success"] is True
        r2 = create_member(email)
        assert r2.json()["success"] is False

    def test_create_missing_required_fields(self):
        r = client.post("/api/members/create", json={"email": "x@x.com"})
        assert r.status_code == 422


# ── get ───────────────────────────────────────────────────────────────────────

class TestGetMember:
    def test_get_existing_member(self):
        created = create_member()
        mid = created.json()["member_id"]
        r = client.post("/api/members/get", json={"member_id": mid})
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert r.json()["member"]["member_id"] == mid

    def test_get_nonexistent_member(self):
        r = client.post("/api/members/get", json={"member_id": "nonexistent-id-xyz"})
        assert r.status_code == 200
        assert r.json()["success"] is False

    def test_get_emits_profile_viewed_event(self):
        created = create_member()
        mid = created.json()["member_id"]

        with patch("app.api.routes.member_routes.publish_event") as mock_pub:
            client.post("/api/members/get", json={
                "member_id": mid,
                "emit_profile_viewed": True,
                "viewer_id": "viewer-001",
            })
            mock_pub.assert_called()


# ── update ────────────────────────────────────────────────────────────────────

class TestUpdateMember:
    def test_update_headline(self):
        created = create_member()
        mid = created.json()["member_id"]
        r = client.post("/api/members/update", json={
            "member_id": mid,
            "headline": "Updated Headline",
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_update_nonexistent(self):
        r = client.post("/api/members/update", json={
            "member_id": "does-not-exist",
            "headline": "X",
        })
        assert r.json()["success"] is False


# ── delete ────────────────────────────────────────────────────────────────────

class TestDeleteMember:
    def test_delete_existing(self):
        created = create_member()
        mid = created.json()["member_id"]
        r = client.post("/api/members/delete", json={"member_id": mid})
        assert r.status_code == 200
        assert r.json()["success"] is True
        r2 = client.post("/api/members/get", json={"member_id": mid})
        assert r2.json()["success"] is False

    def test_delete_nonexistent(self):
        r = client.post("/api/members/delete", json={"member_id": "ghost-id"})
        assert r.json()["success"] is False


# ── search ────────────────────────────────────────────────────────────────────

class TestSearchMembers:
    def test_search_returns_list(self):
        r = client.post("/api/members/search", json={"keyword": "Engineer", "limit": 5})
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert isinstance(r.json().get("members"), list)

    def test_search_by_location(self):
        r = client.post("/api/members/search", json={"location": "San Francisco"})
        assert r.status_code == 200

    def test_search_empty(self):
        r = client.post("/api/members/search", json={})
        assert r.status_code == 200


# ── health ────────────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["success"] is True
