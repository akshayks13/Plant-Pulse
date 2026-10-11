// Remedy returned by the knowledge-base service (apps/retrieval POST /diagnose),
// passed through the backend on Diagnosis.remedy.

export type KbTreatment = {
  control_class: 'chemical' | 'biological' | 'cultural' | 'physical';
  title: string;
  instructions: string;
  active_ingredient?: string | null;
  dose_value?: number | null;
  dose_unit?: string | null;
  dose_basis?: string | null;
  interval_days?: number | null;
  phi_days?: number | null;
  source_tier: 'label' | 'research' | 'none';
};

export type KbDiy = {
  title: string;
  steps: string;
  efficacy: string;
  honesty_note?: string;
  safety_notes?: string | null;
};

export type Remedy = {
  result_type: 'normal' | 'unsure' | 'incurable' | 'healthy';
  message?: string;
  question?: string;
  unsure_reason?: 'out_of_distribution' | 'low_confidence' | 'look_alike_runner_up';
  candidates?: {
    disease_id: string;
    common_name: string;
    crop: string;
    symptoms?: string | null;
    confidence?: number | null;
  }[];
  explanation?: {
    summary: string;
    why_it_happened: string;
    treatment_steps: string[];
    prevention: string[];
  } | null;
  treatments: KbTreatment[];
  diy: KbDiy[];
  care?: { care_notes?: string | null; watch_for?: string | null };
  disclaimer?: string;
};

function describeTreatment(t: KbTreatment): string {
  let text = `${t.title}: ${t.instructions}`;
  if (t.active_ingredient) text += ` (active ingredient: ${t.active_ingredient})`;
  if (t.dose_value != null && t.dose_unit) {
    text += ` — ${t.dose_value} ${t.dose_unit}`;
    if (t.dose_basis) text += ` ${t.dose_basis}`;
    if (t.interval_days) text += `, every ${t.interval_days} days`;
    if (t.phi_days) text += `, ${t.phi_days} days before harvest`;
    // Never present an unverified dose as a label dose.
    if (t.source_tier !== 'label') text += ' [research-suggested, not a label dose]';
  }
  return text;
}

export function remedyToTabs(r: Remedy) {
  return {
    chemical: r.treatments
      .filter(t => t.control_class === 'chemical' || t.control_class === 'biological')
      .map(describeTreatment),
    organic: r.diy.map(d => `${d.title}: ${d.steps}${d.honesty_note ? ` (${d.honesty_note})` : ''}`),
    prevention: [
      ...r.treatments
        .filter(t => t.control_class === 'cultural' || t.control_class === 'physical')
        .map(describeTreatment),
      ...(r.explanation?.prevention ?? []),
    ],
  };
}
