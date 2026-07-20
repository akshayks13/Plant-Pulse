/**
 * mockDiagnosis.ts
 * 
 * When NEXT_PUBLIC_USE_MOCK=true (or backend is unavailable),
 * the frontend uses this instead of hitting the FastAPI backend.
 * 
 * Scans are stored in localStorage under "plant_pulse_scans".
 */

import { getDiseaseInfo } from './diseaseKb';

const DISEASE_POOL = [
  { name: 'Tomato___Early_blight',      severity: 'moderate' as const },
  { name: 'Tomato___Late_blight',       severity: 'critical' as const },
  { name: 'Tomato___healthy',           severity: 'low' as const },
  { name: 'Potato___Early_blight',      severity: 'moderate' as const },
  { name: 'Potato___Late_blight',       severity: 'critical' as const },
  { name: 'Potato___healthy',           severity: 'low' as const },
  { name: 'Pepper___bell___Bacterial_spot', severity: 'high' as const },
  { name: 'Pepper___bell___healthy',    severity: 'low' as const },
  { name: 'Tomato___Leaf_mold',         severity: 'moderate' as const },
  { name: 'Tomato___Spider_mites',      severity: 'low' as const },
  { name: 'Rose___Black_spot',          severity: 'high' as const },
  { name: 'Rose___healthy',             severity: 'low' as const },
  { name: 'Aloe_Vera___Rust',           severity: 'moderate' as const },
  { name: 'Money_Plant___Bacterial_Wilt', severity: 'critical' as const },
  { name: 'Strawberry___Leaf_scorch',   severity: 'moderate' as const },
];

export type MockScan = {
  id: string;
  disease_name: string;
  confidence: number;
  severity: string;
  image_url: string;
  is_healthy: boolean;
  crop_type: string | null;
  created_at: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function seededChoice<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Simulate a diagnosis from an image file */
export async function mockPredict(file: File, cropType?: string): Promise<MockScan> {
  // Brief delay to simulate processing
  await new Promise(r => setTimeout(r, 1800));

  const seed = file.size + file.name.length;
  const pick = seededChoice(DISEASE_POOL, seed);
  const confidence = +(0.72 + (seed % 27) / 100).toFixed(3);
  const imageUrl = URL.createObjectURL(file);

  const scan: MockScan = {
    id: uid(),
    disease_name: pick.name,
    confidence,
    severity: pick.severity,
    image_url: imageUrl,
    is_healthy: pick.name.endsWith('healthy'),
    crop_type: cropType || null,
    created_at: new Date().toISOString(),
  };

  // Persist to localStorage
  const existing = getLocalScans();
  existing.unshift(scan);
  localStorage.setItem('plant_pulse_scans', JSON.stringify(existing.slice(0, 100)));

  return scan;
}

export function getLocalScans(): MockScan[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('plant_pulse_scans') || '[]');
  } catch {
    return [];
  }
}

export function getLocalScan(id: string): MockScan | null {
  return getLocalScans().find(s => s.id === id) || null;
}

/** Whether to use mock mode */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === 'true';
}
