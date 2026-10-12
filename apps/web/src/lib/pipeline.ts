/**
 * Small shared helpers for presenting the scan pipeline
 * (image -> CNN -> retrieval) consistently across pages.
 */
import type { Diagnosis, ResultType, RetrievalStatus, SourceTier } from './api';

export const SEVERITY_COLOR: Record<string, string> = {
  low: '#00e87a',
  moderate: '#f5c542',
  high: '#ff8c42',
  critical: '#ff4a6b',
};

export const RESULT_META: Record<ResultType, { label: string; color: string; icon: string }> = {
  normal:    { label: 'Diagnosis',       color: '#00e87a', icon: '✓' },
  healthy:   { label: 'Healthy',         color: '#00e87a', icon: '🌿' },
  unsure:    { label: 'Needs a closer look', color: '#f5c542', icon: '?' },
  incurable: { label: 'No cure — contain', color: '#ff4a6b', icon: '!' },
};

export const RETRIEVAL_STATUS_META: Record<RetrievalStatus, { label: string; color: string }> = {
  pending:           { label: 'Pending',           color: '#8fab98' },
  ok:                { label: 'Treatment plan ready', color: '#00e87a' },
  unsupported_class: { label: 'Built-in guidance', color: '#f5c542' },
  unavailable:       { label: 'Service offline',   color: '#ff8c42' },
  error:             { label: 'Service error',     color: '#ff4a6b' },
};

export const TIER_META: Record<SourceTier, { label: string; color: string; hint: string }> = {
  label:    { label: 'Registered dose',   color: '#00e87a', hint: 'A registered, per-litre rate for this crop from an official label or extension bulletin.' },
  research: { label: 'Research-suggested', color: '#f5c542', hint: 'From a study or a neighbouring crop. Not a registered dose for this crop.' },
  none:     { label: 'No verified dose',  color: '#8fab98', hint: 'No reliable rate on file. Follow the product label or ask an extension officer.' },
};

export const CONTROL_CLASS_COLOR: Record<string, string> = {
  cultural:   '#00b4d8',
  physical:   '#a78bfa',
  biological: '#00e87a',
  chemical:   '#f5c542',
};

export function modelSourceLabel(src: string | null | undefined): string {
  switch (src) {
    case 'tflite': return 'TFLite CNN';
    case 'keras':  return 'Keras CNN';
    case 'mock':   return 'Mock CNN (no model file)';
    default:       return 'CNN';
  }
}

/** "Tomato___Late_blight" → { crop: "Tomato", name: "Late blight" } */
export function splitLabel(raw: string): { crop: string; name: string } {
  const parts = raw.split('___').filter(Boolean);
  const crop = (parts[0] || 'Plant').replace(/_/g, ' ');
  const name = parts.slice(1).join(' ').replace(/_/g, ' ') || crop;
  return { crop, name };
}

export function prettyLabel(raw: string): string {
  const { crop, name } = splitLabel(raw);
  return name === crop ? crop : `${crop} · ${name}`;
}

/** Split a paragraph into sentences for bullet rendering. */
export function sentences(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}

/** The display name for a diagnosis, preferring the retrieval service's common name. */
export function displayName(d: Diagnosis): string {
  if (d.retrieval?.disease?.common_name) return d.retrieval.disease.common_name;
  return splitLabel(d.disease_name).name;
}

export function cropName(d: Diagnosis): string {
  return d.retrieval?.disease?.crop || splitLabel(d.disease_name).crop;
}

export function formatDose(t: { dose_value: number | null; dose_unit: string | null; dose_basis: string | null }): string | null {
  if (t.dose_value == null || !t.dose_unit) return null;
  const v = Number.isInteger(t.dose_value) ? String(t.dose_value) : t.dose_value.toString();
  return `${v} ${t.dose_unit}${t.dose_basis ? ` · ${t.dose_basis}` : ''}`;
}
