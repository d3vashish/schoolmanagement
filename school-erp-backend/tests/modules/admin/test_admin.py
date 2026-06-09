import pytest
from httpx import AsyncClient


async def _login_as(client: AsyncClient, email: str, password: str = "dummy") -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_non_admin_gets_403(client: AsyncClient, db_session):
    from tests.factories import create_user
    user = await create_user(db_session, email="teacher@test.edu", role="teacher")
    token = await _login_as(client, "teacher@test.edu")
    resp = await client.get("/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_dashboard(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="admin@test.edu", role="super_admin")
    for role in ("teacher", "accountant", "parent", "student"):
        await create_user(db_session, role=role)
    token = await _login_as(client, "admin@test.edu")
    resp = await client.get("/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_users"] >= 5
    assert "teacher" in body["users_by_role"]
    assert "accountant" in body["users_by_role"]


@pytest.mark.asyncio
async def test_list_users_pagination(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="list@test.edu", role="super_admin")
    for i in range(15):
        await create_user(db_session, role="teacher", email=f"teacher{i}@test.edu")
    token = await _login_as(client, "list@test.edu")
    resp = await client.get("/admin/users?page=1&page_size=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) == 5
    assert body["total"] >= 16
    assert body["page"] == 1
    assert body["page_size"] == 5


@pytest.mark.asyncio
async def test_list_users_filter_by_role(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="filter@test.edu", role="super_admin")
    await create_user(db_session, role="teacher", email="t1@test.edu")
    await create_user(db_session, role="teacher", email="t2@test.edu")
    await create_user(db_session, role="accountant", email="a1@test.edu")
    token = await _login_as(client, "filter@test.edu")
    resp = await client.get("/admin/users?role=teacher", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert all(u["role"] == "teacher" for u in body["data"])


@pytest.mark.asyncio
async def test_create_user_lifecycle(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="crud@test.edu", role="super_admin")
    token = await _login_as(client, "crud@test.edu")

    resp = await client.post("/admin/users", json={
        "email": "newteacher@test.edu",
        "password": "StrongPass1!",
        "role": "teacher",
        "first_name": "New",
        "last_name": "Teacher",
        "phone": "9999990000",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    uid = resp.json()["id"]
    assert resp.json()["email"] == "newteacher@test.edu"

    resp = await client.get(f"/admin/users/{uid}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "teacher"
    assert resp.json()["is_active"] is True

    resp = await client.put(f"/admin/users/{uid}", json={"first_name": "Updated"},
                            headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Updated"

    resp = await client.patch(f"/admin/users/{uid}/status", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


@pytest.mark.asyncio
async def test_create_duplicate_email_returns_409(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="dup@test.edu", role="super_admin")
    await create_user(db_session, email="existing@test.edu", role="teacher")
    token = await _login_as(client, "dup@test.edu")
    resp = await client.post("/admin/users", json={
        "email": "existing@test.edu",
        "password": "StrongPass1!",
        "role": "teacher",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_settings_round_trip(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="sett@test.edu", role="super_admin")
    token = await _login_as(client, "sett@test.edu")

    resp = await client.get("/admin/settings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == []

    resp = await client.put("/admin/settings", json=[
        {"key": "school_name", "value": "Test School"},
        {"key": "language", "value": "en"},
    ], headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    resp = await client.get("/admin/settings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    settings = {s["key"]: s["value"] for s in resp.json()}
    assert settings["school_name"] == "Test School"
    assert settings["language"] == "en"


@pytest.mark.asyncio
async def test_audit_log(client: AsyncClient, db_session):
    from tests.factories import create_user
    from app.modules.audit.models import AuditLog

    admin = await create_user(db_session, email="audit@test.edu", role="super_admin")
    db_session.add(AuditLog(table_name="users", record_id=admin.id, action="LOGIN", changed_by=admin.id))
    await db_session.flush()

    token = await _login_as(client, "audit@test.edu")
    resp = await client.get("/admin/audit/log", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) >= 1
    assert body["data"][0]["action"] in ("LOGIN", "CREATE")


@pytest.mark.asyncio
async def test_admin_cannot_disable_self(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="self@test.edu", role="super_admin")
    token = await _login_as(client, "self@test.edu")

    resp = await client.patch(f"/admin/users/{admin.id}/status", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_password(client: AsyncClient, db_session):
    from tests.factories import create_user
    admin = await create_user(db_session, email="pwadmin@test.edu", role="super_admin")
    target = await create_user(db_session, email="target@test.edu", role="teacher")
    token = await _login_as(client, "pwadmin@test.edu")

    resp = await client.post(f"/admin/users/{target.id}/reset-password", json={"new_password": "NewPass123!"},
                             headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    resp = await client.post("/auth/login", json={"email": "target@test.edu", "password": "NewPass123!"})
    assert resp.status_code == 200
