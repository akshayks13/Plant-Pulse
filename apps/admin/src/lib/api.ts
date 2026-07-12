const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('xylem_admin_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) { localStorage.removeItem('xylem_admin_token'); window.location.href = '/login'; throw new Error('Unauthorized'); }
  if (!res.ok) { const e = await res.json().catch(() => ({detail:'Failed'})); throw new Error(e.detail || 'Request failed'); }
  return res.json();
}

export async function adminLogin(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({detail:'Login failed'})); throw new Error(e.detail); }
  return res.json();
}

export async function getMe() { return request('/auth/me'); }

export async function getStats() { return request('/admin/stats'); }

export async function getDiagnoses(page = 1, size = 20) {
  return request(`/admin/diagnoses?page=${page}&size=${size}`);
}

export async function getUsers(page = 1, size = 20) {
  return request(`/admin/users?page=${page}&size=${size}`);
}

export async function updateUser(userId: string, data: object) {
  return request(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getLogs(page = 1, size = 50, level?: string) {
  const q = level ? `&level=${level}` : '';
  return request(`/admin/logs?page=${page}&size=${size}${q}`);
}
