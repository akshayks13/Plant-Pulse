const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('xylem_token');
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

export async function register(email: string, password: string, full_name: string) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name, role: 'FARMER' }),
  });
}

export async function getMe() {
  return request('/auth/me');
}

export async function predictDisease(file: File, cropType?: string) {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  if (cropType) form.append('crop_type', cropType);
  const res = await fetch(`${BASE_URL}/diagnosis/predict`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Prediction failed' }));
    throw new Error(err.detail || 'Prediction failed');
  }
  return res.json();
}

export async function getDiagnosisHistory(page = 1, size = 20) {
  return request(`/diagnosis/history?page=${page}&size=${size}`);
}

export async function getDiagnosis(id: string) {
  return request(`/diagnosis/${id}`);
}

// Admin
export async function adminGetStats() {
  return request('/admin/stats');
}

export async function adminGetDiagnoses(page = 1, size = 20) {
  return request(`/admin/diagnoses?page=${page}&size=${size}`);
}

export async function adminGetUsers(page = 1, size = 20) {
  return request(`/admin/users?page=${page}&size=${size}`);
}

export async function adminUpdateUser(userId: string, data: { is_active: boolean }) {
  return request(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function adminGetLogs(page = 1, size = 50) {
  return request(`/admin/logs?page=${page}&size=${size}`);
}
