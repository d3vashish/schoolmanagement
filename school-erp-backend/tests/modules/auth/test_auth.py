import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_returns_tokens(client: AsyncClient, db_session):
    from tests.factories import create_user
    await create_user(db_session, email="login@test.edu", role="principal")

    resp = await client.post("/auth/login", json={
        "email": "login@test.edu",
        "password": "dummy",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client: AsyncClient, db_session):
    from tests.factories import create_user
    await create_user(db_session, email="auth@test.edu", role="parent")

    resp = await client.post("/auth/login", json={
        "email": "auth@test.edu",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation(client: AsyncClient, db_session):
    from tests.factories import create_user
    user = await create_user(db_session, email="refresh@test.edu", role="teacher")

    login_resp = await client.post("/auth/login", json={
        "email": "refresh@test.edu",
        "password": "dummy",
    })
    old_refresh = login_resp.json()["refresh_token"]

    refresh_resp = await client.post("/auth/refresh", json={
        "refresh_token": old_refresh,
    })
    assert refresh_resp.status_code == 200
    new_refresh = refresh_resp.json()["refresh_token"]
    assert new_refresh != old_refresh


@pytest.mark.asyncio
async def test_logout_revokes_refresh(client: AsyncClient, db_session):
    from tests.factories import create_user
    await create_user(db_session, email="logout@test.edu", role="librarian")

    login_resp = await client.post("/auth/login", json={
        "email": "logout@test.edu",
        "password": "dummy",
    })
    refresh = login_resp.json()["refresh_token"]
    token = login_resp.json()["access_token"]

    logout_resp = await client.post("/auth/logout", json={
        "refresh_token": refresh,
    }, headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 204

    refresh_resp = await client.post("/auth/refresh", json={
        "refresh_token": refresh,
    })
    assert refresh_resp.status_code == 401
