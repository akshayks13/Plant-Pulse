// Simple mock data for admin dashboard when backend is not connected/active

const MOCK_STATS = {
  total_users: 142,
  total_diagnoses: 1048,
  active_users_today: 18,
  diagnoses_today: 43,
  top_diseases: [
    { name: 'Tomato___Early_blight', count: 324 },
    { name: 'Rose___Black_spot', count: 212 },
    { name: 'Potato___Late_blight', count: 185 },
    { name: 'Tomato___healthy', count: 140 },
    { name: 'Aloe_Vera___Rust', count: 98 },
    { name: 'Money_Plant___Bacterial_Wilt', count: 89 }
  ],
  system_health: 'healthy'
};

const MOCK_DIAGNOSES = {
  items: [
    { id: '1', disease_name: 'Tomato___Early_blight', confidence: 0.942, severity: 'moderate', image_url: '', created_at: new Date().toISOString(), user_id: 'u1', user_email: 'farmer.joe@gmail.com' },
    { id: '2', disease_name: 'Rose___Black_spot', confidence: 0.885, severity: 'high', image_url: '', created_at: new Date(Date.now() - 3600000).toISOString(), user_id: 'u2', user_email: 'flora.gardens@yahoo.com' },
    { id: '3', disease_name: 'Tomato___healthy', confidence: 0.981, severity: 'low', image_url: '', created_at: new Date(Date.now() - 7200000).toISOString(), user_id: 'u3', user_email: 'agri.tech@hotmail.com' },
    { id: '4', disease_name: 'Potato___Late_blight', confidence: 0.764, severity: 'critical', image_url: '', created_at: new Date(Date.now() - 10800000).toISOString(), user_id: 'u4', user_email: 'potato.king@gmail.com' }
  ],
  total: 4,
  page: 1,
  size: 20
};

const MOCK_USERS = {
  items: [
    { id: 'u1', email: 'admin@plant-pulse.ai', full_name: 'Plant-Pulse Admin', role: 'ADMIN', is_active: true, created_at: '2025-01-01T00:00:00.000Z', total_diagnoses: 0 },
    { id: 'u2', email: 'farmer.joe@gmail.com', full_name: 'Farmer Joe', role: 'FARMER', is_active: true, created_at: '2025-02-12T14:30:00.000Z', total_diagnoses: 124 },
    { id: 'u3', email: 'flora.gardens@yahoo.com', full_name: 'Flora Gardens', role: 'FARMER', is_active: true, created_at: '2025-03-05T09:15:00.000Z', total_diagnoses: 87 },
    { id: 'u4', email: 'agri.tech@hotmail.com', full_name: 'Agri Tech Group', role: 'FARMER', is_active: true, created_at: '2025-04-20T16:45:00.000Z', total_diagnoses: 42 }
  ],
  total: 4
};

const MOCK_LOGS = {
  items: [
    { id: 'l1', level: 'INFO', message: 'Database initialized successfully', source: 'database', created_at: new Date().toISOString() },
    { id: 'l2', level: 'INFO', message: 'New user registered: farmer.joe@gmail.com', source: 'auth', created_at: new Date(Date.now() - 600000).toISOString() },
    { id: 'l3', level: 'WARNING', message: 'TFLite runtime optional dependency missing, fallback active', source: 'ml_service', created_at: new Date(Date.now() - 1200000).toISOString() },
    { id: 'l4', level: 'INFO', message: 'User logged in: admin@plant-pulse.ai', source: 'auth', created_at: new Date(Date.now() - 1800000).toISOString() }
  ]
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('plant_pulse_admin_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (res.status === 401) {
      localStorage.removeItem('plant_pulse_admin_token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: 'Failed' }));
      throw new Error(e.detail || 'Request failed');
    }
    return res.json();
  } catch (err) {
    // Fallback Mock Data if API fails/unconnected
    console.warn(`API call failed to ${path}, using mock fallback:`, err);
    if (path.startsWith('/admin/stats')) return MOCK_STATS as unknown as T;
    if (path.startsWith('/admin/diagnoses')) return MOCK_DIAGNOSES as unknown as T;
    if (path.startsWith('/admin/users')) return MOCK_USERS as unknown as T;
    if (path.startsWith('/admin/logs')) return MOCK_LOGS as unknown as T;
    if (path.startsWith('/auth/me')) {
      return { id: 'u1', email: 'admin@plant-pulse.ai', full_name: 'Plant-Pulse Admin', role: 'ADMIN', is_active: true } as unknown as T;
    }
    throw err;
  }
}

export async function adminLogin(email: string, password: string) {
  try {
    const form = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(e.detail);
    }
    return res.json();
  } catch (err) {
    console.warn("Backend login failed/unconnected, using mock auth session:", err);
    // Simple mock validation (any password matches for dev/mock mode)
    if (email.toLowerCase() === 'admin@plant-pulse.ai') {
      return { access_token: 'mock-admin-token-12345' };
    }
    throw new Error('Invalid mock admin credentials. Use admin@plant-pulse.ai');
  }
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
