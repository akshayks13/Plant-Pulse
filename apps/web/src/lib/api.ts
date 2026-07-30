const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function getApiBase() {
  return BASE_URL;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('plant_pulse_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  return `${BASE_URL}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    const detail = err.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Request failed');
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
  return res.json() as Promise<{ access_token: string; token_type: string }>;
}

export async function register(email: string, password: string, full_name: string) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name, role: 'FARMER' }),
  });
}

export async function getMe() {
  return request<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }>('/auth/me');
}

export async function updateProfile(full_name: string) {
  return request<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ full_name }),
  });
}

export async function forgotPassword(email: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, otp: string) {
  return request<{ message: string; valid: boolean }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

export async function resetPassword(email: string, otp: string, new_password: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, new_password }),
  });
}

export type Diagnosis = {
  id: string;
  disease_name: string;
  confidence: number;
  severity: string;
  image_url: string | null;
  is_healthy: boolean;
  crop_type: string | null;
  created_at: string;
  user_id?: string;
};

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
  return res.json() as Promise<Diagnosis>;
}

export async function getDiagnosisHistory(page = 1, size = 20) {
  return request<{ items: Diagnosis[]; total: number; page: number; size: number }>(
    `/diagnosis/history?page=${page}&size=${size}`
  );
}

export async function getDiagnosis(id: string) {
  return request<Diagnosis>(`/diagnosis/${id}`);
}

export type CommunityPost = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  category: string;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  created_at: string;
  author: { id: string | null; full_name: string; email: string | null };
  comments?: CommunityComment[];
};

export type CommunityComment = {
  id: string;
  content: string;
  created_at: string;
  author: { id: string | null; full_name: string; email: string | null };
  comments_count?: number;
};

export async function getCommunityPosts(page = 1, size = 20, category?: string) {
  const q = category ? `&category=${encodeURIComponent(category)}` : '';
  return request<{ items: CommunityPost[]; total: number; page: number; size: number }>(
    `/community/posts?page=${page}&size=${size}${q}`
  );
}

export async function getCommunityPost(id: string) {
  return request<CommunityPost>(`/community/posts/${id}`);
}

export async function createCommunityPost(data: {
  title: string;
  content: string;
  category?: string;
  file?: File | null;
}) {
  const token = getToken();
  const form = new FormData();
  form.append('title', data.title);
  form.append('content', data.content);
  form.append('category', data.category || 'general');
  if (data.file) form.append('file', data.file);
  const res = await fetch(`${BASE_URL}/community/posts`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create post' }));
    throw new Error(err.detail || 'Failed to create post');
  }
  return res.json() as Promise<CommunityPost>;
}

export async function likeCommunityPost(id: string) {
  return request<{ liked: boolean; likes_count: number }>(`/community/posts/${id}/like`, {
    method: 'POST',
  });
}

export async function commentCommunityPost(id: string, content: string) {
  return request<CommunityComment>(`/community/posts/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteCommunityPost(id: string) {
  return request<{ message: string }>(`/community/posts/${id}`, { method: 'DELETE' });
}

// Admin helpers (web client; admin app has its own)
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
