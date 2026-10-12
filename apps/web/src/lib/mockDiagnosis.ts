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

// Same 20 classes as the trained CNN models (apps/model_file).
const DISEASE_POOL = [
  { name: 'Beetel_Anthracnose',          severity: 'high' },
  { name: 'Beetel_Bacterial_Spot',       severity: 'high' },
  { name: 'Beetel_Healthy',              severity: 'low' },
  { name: 'Beetel_Powdery_Mildew',       severity: 'moderate' },
  { name: 'Guava_Algal_Spot',            severity: 'low' },
  { name: 'Guava_Anthracnose',           severity: 'high' },
  { name: 'Guava_Healthy',               severity: 'low' },
  { name: 'Guava_Red_Rust',              severity: 'moderate' },
  { name: 'Hibiscus_Black_Spot',         severity: 'moderate' },
  { name: 'Hibiscus_Healthy',            severity: 'low' },
  { name: 'Hibiscus_Rust',               severity: 'moderate' },
  { name: 'Hibiscus_Yellow_Vein_Mosaic', severity: 'critical' },
  { name: 'Mint_Healthy',                severity: 'low' },
  { name: 'Mint_Leaf_Spot',              severity: 'moderate' },
  { name: 'Mint_Powdery_Mildew',         severity: 'moderate' },
  { name: 'Mint_Rust',                   severity: 'moderate' },
  { name: 'Papaya_Black_Spot',           severity: 'moderate' },
  { name: 'Papaya_Healthy',              severity: 'low' },
  { name: 'Papaya_Leaf_Blight',          severity: 'high' },
  { name: 'Papaya_Ringspot',             severity: 'critical' },
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
    is_healthy: pick.name.toLowerCase().endsWith('healthy'),
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
