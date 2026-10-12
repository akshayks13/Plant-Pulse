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

/** Thrown when the API host itself cannot be reached (backend not running). */
export class ApiUnreachableError extends Error {
  constructor() {
    super(`Cannot reach the Plant-Pulse API at ${BASE_URL}. Start the backend (apps/backend: python3 run.py) and try again.`);
    this.name = 'ApiUnreachableError';
  }
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiUnreachableError();
  }
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

  const res = await safeFetch(`${BASE_URL}${path}`, {
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

// ─── Diagnosis pipeline types ─────────────────────────────────────────────────
// Mirrors apps/backend/app/routes/diagnosis.py (DiagnosisOut) and the retrieval
// service's /diagnose payload (apps/retrieval/README_API.md).

export type Candidate = { label: string; confidence: number };
export type ResultType = 'normal' | 'unsure' | 'incurable' | 'healthy';
export type RetrievalStatus = 'pending' | 'ok' | 'unsupported_class' | 'unavailable' | 'error';
export type SourceTier = 'label' | 'research' | 'none';
/** Keys of the CNN models the backend can run (see GET /diagnosis/models). */
export type ModelKey = 'efficientnet' | 'mobilenet' | 'densenet';
export type ModelSource = ModelKey | 'mock';

export type ModelInfo = {
  key: ModelKey;
  label: string;          // e.g. "EfficientNet-B0"
  file: string;           // checkpoint file name
  available: boolean;     // false if the .pth file is missing on the server
  val_acc: number | null; // validation accuracy (%) saved in the checkpoint
  params_m: number | null;
  size_mb: number | null;
  is_default: boolean;
};

export type RetrievalDisease = {
  disease_id: string;
  common_name: string;
  crop: string;
  pathogen: string | null;
  pathogen_type: string | null;
  curability: 'curable' | 'manageable' | 'incurable' | string;
  is_healthy_class: boolean;
  symptoms: string | null;
};

export type RetrievalCandidate = {
  disease_id: string;
  common_name: string;
  crop: string;
  symptoms: string | null;
  confidence: number | null;
};

export type Citation = {
  chunk_id: number;
  section: string;
  title: string | null;
  source_name: string | null;
  source_url: string | null;
};

export type Explanation = {
  summary: string;
  why_it_happened: string;
  treatment_steps: string[];
  prevention: string[];
  citations: Citation[];
  generated_by: 'llm' | 'template';
  note: string;
};

export type Treatment = {
  treatment_id: number;
  disease_id: string;
  control_class: 'cultural' | 'physical' | 'biological' | 'chemical' | string;
  title: string;
  instructions: string;
  priority: number;
  active_ingredient: string | null;
  frac_code: string | null;
  irac_code: string | null;
  organic_approved: boolean | null;
  hazard_notes: string | null;
  dose_value: number | null;
  dose_unit: string | null;
  dose_basis: string | null;
  interval_days: number | null;
  phi_days: number | null;
  verified: boolean;
  source_tier: SourceTier;
  label_registered: boolean | null;
  source_name: string | null;
  source_url: string | null;
};

export type DiyIngredient = {
  item: string;
  quantity: number | null;
  unit: string | null;
  home_available: boolean;
};

export type DiyRemedy = {
  diy_id: string;
  title: string;
  ingredients: DiyIngredient[];
  steps: string;
  prep_time_hours: number | null;
  efficacy: 'preventive' | 'mild_curative' | string;
  feasibility_score: number | null;
  safety_notes: string | null;
  evidence: string | null;
  verified: boolean;
  source_url: string | null;
  honesty_note: string;
};

export type Product = {
  name: string;
  price: number | null;
  currency: string | null;
  price_text: string | null;
  vendor: string | null;
  url: string | null;
  concentration: string | null;
  verified_by: string;
  retrieved_at: string;
};

/** A real product found by web search (apps/retrieval/data/product_catalog.yaml). */
export type CatalogProduct = {
  ingredient: string;
  name: string;
  maker: string;
  formulation: string;
  product_url: string;       // maker page = our source
  seller_url?: string;       // one online shop that lists it
  shop_url: string;          // live shop search, for today's price
  note?: string;
};

/** Products grouped by the active ingredient they contain. */
export type ProductGroup = {
  ingredient: string;
  used_for: string;          // title of the treatment that needs it
  control_class: string;
  frac_code: string | null;
  organic_approved: boolean | null;
  products: CatalogProduct[];
  search_url: string;        // shop search for the ingredient itself
};

export type RetrievalSummary = {
  chunks_used: { chunk_id: number; section: string; score: number; source_name: string | null }[];
  best_score: number;
  note: string | null;
};

export type RetrievalResult = {
  result_type: ResultType;
  class_label: string;
  confidence: number;
  disease: RetrievalDisease;
  candidates: RetrievalCandidate[];
  explanation: Explanation | null;
  treatments: Treatment[];
  diy: DiyRemedy[];
  products: Product[];
  disclaimer: string;
  // unsure
  question?: string;
  unsure_reason?: 'low_confidence' | 'look_alike_runner_up' | 'out_of_distribution';
  message?: string;
  // incurable
  report_prompt?: string | null;
  // normal
  product_note?: string;
  product_ingredient?: string;
  product_groups?: ProductGroup[];
  catalog_retrieved_on?: string | null;
  products_searched_at?: string | null;
  // healthy
  care?: { care_notes: string | null; watch_for: string | null };
  retrieval?: RetrievalSummary;
};

export type Diagnosis = {
  id: string;
  user_id?: string;
  created_at: string;
  image_url: string | null;
  crop_type: string | null;
  // CNN step
  disease_name: string;
  confidence: number;
  severity: string;
  is_healthy: boolean;
  model_source: ModelSource | string | null;
  candidates: Candidate[];
  runner_up: Candidate | null;
  // Retrieval step
  result_type: ResultType | null;
  retrieval_status: RetrievalStatus;
  retrieval_note: string | null;
  retrieval_at: string | null;
  confirmed_disease_id: string | null;
  retrieval: RetrievalResult | null;
};

/**
 * Step 1 of the scan pipeline: upload the image and run the CNN.
 * With `runRetrieval: false` the backend stops after classification so the UI
 * can call `retrieveTreatment()` as an explicit second step.
 */
export async function predictDisease(
  file: File,
  opts: { model?: ModelKey; cropType?: string; runRetrieval?: boolean } = {},
) {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  if (opts.model) form.append('model', opts.model);
  if (opts.cropType) form.append('crop_type', opts.cropType);
  form.append('run_retrieval', String(opts.runRetrieval ?? true));
  const res = await safeFetch(`${BASE_URL}/diagnosis/predict`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Prediction failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Prediction failed');
  }
  return res.json() as Promise<Diagnosis>;
}

/**
 * Step 2 of the scan pipeline: send the CNN result to the retrieval service and
 * store the treatment plan. Also used to retry after an outage, or to confirm
 * one of the candidates from an "unsure" result.
 */
export async function retrieveTreatment(
  id: string,
  body: { question?: string; confirmed_disease_id?: string } = {},
) {
  return request<Diagnosis>(`/diagnosis/${id}/retrieve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** The CNN models the user can choose from on the scan page. */
export async function getModels() {
  return request<{ models: ModelInfo[]; default: ModelKey }>('/diagnosis/models');
}

export async function getDiagnosisHistory(page = 1, size = 20) {
  return request<{ items: Diagnosis[]; total: number; page: number; size: number }>(
    `/diagnosis/history?page=${page}&size=${size}`
  );
}

export async function getDiagnosis(id: string) {
  return request<Diagnosis>(`/diagnosis/${id}`);
}

export type ApiHealth = {
  status: string;
  cnn: { model_source: string; model_path: string; model_loaded: boolean };
  retrieval: { url: string; reachable: boolean; status?: string; kb_chunks?: number; llm_configured?: boolean };
};

export async function getApiHealth() {
  const res = await safeFetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json() as Promise<ApiHealth>;
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
