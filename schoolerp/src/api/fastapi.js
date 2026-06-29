// api/fastapi.js
//
// Thin fetch wrapper for your real FastAPI backend.
// Mirrors the auth pattern already used in AuthContext.jsx:
//   - token lives in sessionStorage under 'erp_access_token'
//   - sent as `Authorization: Bearer <token>`
//   - calls go through the Vite proxy at /api/* -> 127.0.0.1:8001/*
//     (see vite.config.js: proxyReq.path strips the leading /api)
//
// So from the frontend's point of view, the base path is just '/api'.
// e.g. fetchApi('/homework') actually hits FastAPI's GET /homework.

const BASE_URL = '/api';

function getToken() {
  return sessionStorage.getItem('erp_access_token');
}

async function fetchApi(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // 204 No Content - nothing to parse
  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function apiGet(path) {
  return fetchApi(path, { method: 'GET' });
}

export function apiPost(path, body) {
  return fetchApi(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPatch(path, body) {
  return fetchApi(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function apiDelete(path) {
  return fetchApi(path, { method: 'DELETE' });
}