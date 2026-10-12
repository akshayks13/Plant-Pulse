/**
 * mockDiagnosis.ts
 *
 * Opt-in offline demo mode. Only active when NEXT_PUBLIC_USE_MOCK=true; the
 * app never silently falls back to it, so a broken backend shows a real error.
 *
 * Mock scans mirror the backend's Diagnosis shape (CNN step only - there is no
 * retrieval payload, so the results page shows the built-in guidance path).
 * Scans are stored in localStorage under "plant_pulse_scans".
 */

import type { Diagnosis } from './api';

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

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function seededChoice<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Simulate the CNN step from an image file (mock mode only). */
export async function mockPredict(file: File, cropType?: string): Promise<Diagnosis> {
  await new Promise(r => setTimeout(r, 1200));

  const seed = file.size + file.name.length;
  const pick = seededChoice(DISEASE_POOL, seed);
  const runner = seededChoice(DISEASE_POOL, seed + 3);
  const confidence = +(0.72 + (seed % 27) / 100).toFixed(3);
  const runnerConf = +((1 - confidence) * 0.6).toFixed(3);

  const scan: Diagnosis = {
    id: uid(),
    created_at: new Date().toISOString(),
    image_url: URL.createObjectURL(file),
    crop_type: cropType || null,
    disease_name: pick.name,
    confidence,
    severity: pick.severity,
    is_healthy: pick.name.endsWith('healthy'),
    model_source: 'mock',
    candidates: [
      { label: pick.name, confidence },
      { label: runner.name, confidence: runnerConf },
    ],
    runner_up: { label: runner.name, confidence: runnerConf },
    result_type: null,
    retrieval_status: 'unavailable',
    retrieval_note: 'Offline demo mode (NEXT_PUBLIC_USE_MOCK=true): the treatment service is not called.',
    retrieval_at: null,
    confirmed_disease_id: null,
    retrieval: null,
  };

  const existing = getLocalScans();
  existing.unshift(scan);
  localStorage.setItem('plant_pulse_scans', JSON.stringify(existing.slice(0, 100)));
  return scan;
}

export function getLocalScans(): Diagnosis[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('plant_pulse_scans') || '[]');
  } catch {
    return [];
  }
}

export function getLocalScan(id: string): Diagnosis | null {
  return getLocalScans().find(s => s.id === id) || null;
}

/** Whether offline demo mode is on (explicit opt-in). */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === 'true';
}
