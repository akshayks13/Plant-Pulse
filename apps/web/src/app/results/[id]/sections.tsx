'use client';
/**
 * Presentational pieces of the results page. Each one renders a slice of the
 * backend's Diagnosis (CNN step) or the retrieval service's payload.
 */
import { useState } from 'react';
import type { Candidate, Diagnosis, DiyRemedy, Explanation, RetrievalResult, Treatment } from '@/lib/api';
import type { DiseaseInfo } from '@/lib/diseaseKb';
import {
  CONTROL_CLASS_COLOR, RESULT_META, RETRIEVAL_STATUS_META, TIER_META,
  formatDose, modelSourceLabel, prettyLabel, sentences,
} from '@/lib/pipeline';
import styles from './results.module.css';

// ── Pipeline strip (top of page) ─────────────────────────────────────────────

export function PipelineStrip({ data }: { data: Diagnosis }) {
  const ok = data.retrieval_status === 'ok' && data.retrieval;
  const type = ok ? data.retrieval!.result_type : null;
  const status = RETRIEVAL_STATUS_META[data.retrieval_status];
  const retrState = ok ? 'done' : data.retrieval_status === 'pending' ? 'todo' : 'warn';

  const nodes = [
    { title: 'Image', sub: 'Uploaded & stored', state: 'done' as const, color: '#00e87a' },
    {
      title: 'CNN classification',
      sub: `${prettyLabel(data.disease_name)} · ${Math.round(data.confidence * 100)}% · ${modelSourceLabel(data.model_source)}`,
      state: 'done' as const, color: '#00e87a',
    },
    {
      title: 'Treatment retrieval',
      sub: ok && type ? `${status.label} · ${RESULT_META[type].label}` : (data.retrieval_note || status.label),
      state: retrState as 'done' | 'todo' | 'warn',
      color: ok && type ? RESULT_META[type].color : status.color,
    },
  ];

  return (
    <div className={styles.strip} aria-label="Pipeline">
      {nodes.map((n, i) => (
        <div key={n.title} className={styles.node}>
          <span className={`${styles.nodeIcon} ${styles[`node_${n.state}`]}`} style={{ color: n.state === 'done' ? '#060d0a' : n.color, background: n.state === 'done' ? n.color : undefined, borderColor: n.color }}>
            {n.state === 'done' ? '✓' : n.state === 'warn' ? '!' : i + 1}
          </span>
          <div className={styles.nodeBody}>
            <span className={styles.nodeTitle}>{n.title}</span>
            <span className={styles.nodeSub} style={n.state === 'warn' ? { color: n.color } : undefined}>{n.sub}</span>
          </div>
          {i < nodes.length - 1 && <span className={styles.connector} />}
        </div>
      ))}
    </div>
  );
}

// ── Model candidates (left column) ───────────────────────────────────────────

export function CandidatesCard({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className={styles.candCard}>
      <h3 className={styles.cardTitle}>Model candidates</h3>
      <ul className={styles.candList}>
        {candidates.map((c, i) => {
          const pct = Math.round(c.confidence * 100);
          return (
            <li key={c.label} className={styles.candRow}>
              <span className={styles.candLabel} title={c.label}>{prettyLabel(c.label)}</span>
              <span className={styles.candBar}><span className={styles.candFill} style={{ width: `${pct}%`, opacity: i === 0 ? 1 : 0.45 }} /></span>
              <span className={styles.candPct}>{pct}%</span>
            </li>
          );
        })}
      </ul>
      <p className={styles.cardHint}>The runner-up is sent to the retriever for a look-alike check.</p>
    </div>
  );
}

// ── Status banner ────────────────────────────────────────────────────────────

export function StatusBanner({ data, onRetry, busy }: { data: Diagnosis; onRetry: () => void; busy: boolean }) {
  const r = data.retrieval;
  const st = data.retrieval_status;

  if (st !== 'ok' || !r) {
    const retriable = st === 'unavailable' || st === 'error' || st === 'pending';
    return (
      <div className={`${styles.banner} ${st === 'unsupported_class' ? styles.banner_info : styles.banner_warn}`}>
        <span className={styles.bannerIcon}>{st === 'unsupported_class' ? 'i' : '!'}</span>
        <div className={styles.bannerBody}>
          <p className={styles.bannerTitle}>
            {st === 'unsupported_class' ? 'Showing built-in guidance'
              : st === 'pending' ? 'Treatment plan not fetched yet'
              : 'Treatment service unavailable'}
          </p>
          <p className={styles.bannerText}>{data.retrieval_note || RETRIEVAL_STATUS_META[st].label}</p>
        </div>
        {retriable && (
          <button className={styles.smallBtn} onClick={onRetry} disabled={busy}>
            {busy ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>
    );
  }

  if (r.result_type === 'incurable') {
    return (
      <div className={`${styles.banner} ${styles.banner_danger}`}>
        <span className={styles.bannerIcon}>!</span>
        <div className={styles.bannerBody}>
          <p className={styles.bannerTitle}>No cure exists — remove and contain</p>
          <p className={styles.bannerText}>{r.message}</p>
          {r.report_prompt && <p className={styles.bannerText}><b>Report it:</b> {r.report_prompt}</p>}
        </div>
      </div>
    );
  }

  if (r.result_type === 'unsure') {
    return (
      <div className={`${styles.banner} ${styles.banner_warn}`}>
        <span className={styles.bannerIcon}>?</span>
        <div className={styles.bannerBody}>
          <p className={styles.bannerTitle}>
            {r.unsure_reason === 'look_alike_runner_up' ? 'Two look-alike diseases are possible'
              : r.unsure_reason === 'out_of_distribution' ? 'This does not look like a clear leaf photo'
              : 'The model is not confident enough'}
          </p>
          <p className={styles.bannerText}>No treatment is given until the disease is confirmed. Compare the candidates below.</p>
        </div>
      </div>
    );
  }

  if (r.result_type === 'healthy') {
    return (
      <div className={`${styles.banner} ${styles.banner_ok}`}>
        <span className={styles.bannerIcon}>✓</span>
        <div className={styles.bannerBody}>
          <p className={styles.bannerTitle}>No disease detected</p>
          <p className={styles.bannerText}>Care guidance for this crop is below, along with the first warning sign to watch for.</p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Explanation ──────────────────────────────────────────────────────────────

export function ExplanationCard({ e }: { e: Explanation }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.expCard}>
      <p className={styles.expSummary}>{e.summary}</p>
      {e.why_it_happened && (
        <>
          <button className={styles.expToggle} onClick={() => setOpen(v => !v)} aria-expanded={open}>
            {open ? '▾' : '▸'} Why it happened
          </button>
          {open && <p className={styles.expWhy}>{e.why_it_happened}</p>}
        </>
      )}
      <div className={styles.expFoot}>
        <span className={styles.genChip} title={e.note}>
          {e.generated_by === 'llm' ? 'Written by Claude from retrieved passages' : 'Assembled from the knowledge base'}
        </span>
      </div>
    </div>
  );
}

// ── Treatment card ───────────────────────────────────────────────────────────

export function TreatmentCard({ t, index }: { t: Treatment; index: number }) {
  const tier = TIER_META[t.source_tier] || TIER_META.none;
  const dose = formatDose(t);
  const cc = CONTROL_CLASS_COLOR[t.control_class] || '#8fab98';
  const showDose = !!(t.active_ingredient || dose);

  return (
    <article className={styles.tCard}>
      <div className={styles.tHead}>
        <span className={styles.tNum}>{index + 1}</span>
        <div className={styles.tHeadText}>
          <div className={styles.tChips}>
            <span className={styles.chip} style={{ color: cc, borderColor: `${cc}40`, background: `${cc}12` }}>{t.control_class}</span>
            {t.organic_approved && <span className={styles.chip} style={{ color: '#00e87a', borderColor: '#00e87a40', background: '#00e87a12' }}>organic-approved</span>}
            {t.frac_code && <span className={styles.chipMuted} title="Fungicide Resistance Action Committee group">FRAC {t.frac_code}</span>}
            {t.irac_code && <span className={styles.chipMuted} title="Insecticide Resistance Action Committee group">IRAC {t.irac_code}</span>}
          </div>
          <h4 className={styles.tTitle}>{t.title}</h4>
          {t.active_ingredient && <p className={styles.tAi}>Active ingredient · <b>{t.active_ingredient}</b></p>}
        </div>
      </div>

      {showDose && (
        <div className={styles.doseRow} style={{ borderColor: `${tier.color}35` }}>
          <span className={styles.tierBadge} style={{ color: tier.color, background: `${tier.color}14` }} title={tier.hint}>
            {tier.label}
          </span>
          {dose
            ? <span className={styles.doseVal}>{dose}</span>
            : <span className={styles.doseNone}>No number shown without a verified source — follow the product label.</span>}
          {t.interval_days != null && <span className={styles.doseMeta}>every {t.interval_days} d</span>}
          {t.phi_days != null && <span className={styles.doseMeta} title="Pre-harvest interval">PHI {t.phi_days} d</span>}
        </div>
      )}

      <p className={styles.tBody}>{t.instructions}</p>
      {t.hazard_notes && <p className={styles.hazard}>⚠ {t.hazard_notes}</p>}
      {(t.source_name || t.source_url) && (
        <p className={styles.srcLine}>
          Source · {t.source_url
            ? <a href={t.source_url} target="_blank" rel="noreferrer">{t.source_name || t.source_url}</a>
            : t.source_name}
        </p>
      )}
    </article>
  );
}

// ── DIY remedy card ──────────────────────────────────────────────────────────

export function DiyCard({ d }: { d: DiyRemedy }) {
  const eff = d.efficacy === 'preventive'
    ? { label: 'Preventive only', color: '#f5c542' }
    : d.efficacy === 'mild_curative'
      ? { label: 'Mildly curative', color: '#00e87a' }
      : { label: d.efficacy.replace(/_/g, ' '), color: '#8fab98' };
  const ingredients = Array.isArray(d.ingredients) ? d.ingredients : [];

  return (
    <article className={styles.diyCard}>
      <div className={styles.diyHead}>
        <h4 className={styles.tTitle}>{d.title}</h4>
        <span className={styles.chip} style={{ color: eff.color, borderColor: `${eff.color}40`, background: `${eff.color}12` }}>{eff.label}</span>
      </div>
      <div className={styles.diyMeta}>
        {d.feasibility_score != null && (
          <span className={styles.feas} title={`Feasibility ${d.feasibility_score}/5`}>
            Feasibility {[1,2,3,4,5].map(n => <i key={n} className={`${styles.feasDot} ${n <= (d.feasibility_score || 0) ? styles.feasDotOn : ''}`} />)}
          </span>
        )}
        {d.prep_time_hours != null && <span>Prep ≈ {d.prep_time_hours < 1 ? `${Math.round(d.prep_time_hours * 60)} min` : `${d.prep_time_hours} h`}</span>}
      </div>
      {ingredients.length > 0 && (
        <ul className={styles.diyIng}>
          {ingredients.map((ing, i) => (
            <li key={i} className={styles.diyIngItem}>
              <span>{ing.item}</span>
              <span className={styles.diyIngQty}>
                {ing.quantity != null ? `${ing.quantity} ${ing.unit || ''}` : (ing.unit ? `(${ing.unit})` : '')}
                {ing.home_available && <i className={styles.diyIngHome} title="Usually available at home">home</i>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.tBody}>{d.steps}</p>
      {d.safety_notes && <p className={styles.hazard}>⚠ {d.safety_notes}</p>}
      <p className={styles.diyHonesty}>{d.honesty_note}</p>
      {d.source_url && <p className={styles.srcLine}>Source · <a href={d.source_url} target="_blank" rel="noreferrer">{d.source_url}</a></p>}
    </article>
  );
}

// ── Products ─────────────────────────────────────────────────────────────────

export function ProductsPanel({ r }: { r: RetrievalResult }) {
  return (
    <div className={styles.cardStack}>
      {r.product_ingredient && (
        <p className={styles.prodLead}>
          Looking for a registered product containing <span className={styles.ingredientChip}>{r.product_ingredient}</span>
        </p>
      )}
      {r.products.length > 0 ? (
        <ul className={styles.prodList}>
          {r.products.map((p, i) => (
            <li key={i} className={styles.prodCard}>
              <div className={styles.prodMain}>
                <span className={styles.prodName}>{p.name}</span>
                <span className={styles.prodMeta}>
                  {p.vendor && <span>{p.vendor}</span>}
                  {p.concentration && <span>· {p.concentration}</span>}
                  <span>· verified by {p.verified_by}</span>
                </span>
              </div>
              <div className={styles.prodSide}>
                {p.price_text && <span className={styles.prodPrice}>{p.price_text}</span>}
                {p.url && <a className={styles.smallBtn} href={p.url} target="_blank" rel="noreferrer">View</a>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.prodNote}>{r.product_note || 'No products were suggested for this result.'}</p>
      )}
      {r.products_searched_at && (
        <p className={styles.cardHint}>Prices are live snapshots from {new Date(r.products_searched_at).toLocaleString()} and may be stale. Confirm on the vendor page.</p>
      )}
    </div>
  );
}

// ── Sources / citations ──────────────────────────────────────────────────────

export function SourcesPanel({ r }: { r: RetrievalResult }) {
  const cites = r.explanation?.citations ?? [];
  return (
    <div className={styles.cardStack}>
      {cites.length > 0 ? (
        <ul className={styles.srcList}>
          {cites.map(c => (
            <li key={c.chunk_id} className={styles.srcItem}>
              <span className={styles.srcSection}>{c.section}</span>
              <div>
                <p className={styles.srcTitle}>{c.title || `Passage #${c.chunk_id}`}</p>
                <p className={styles.srcName}>
                  {c.source_url
                    ? <a href={c.source_url} target="_blank" rel="noreferrer">{c.source_name || c.source_url}</a>
                    : (c.source_name === 'curated_kb' ? 'Plant-Pulse curated knowledge base' : c.source_name)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className={styles.noData}>No citations were recorded for this answer.</p>}

      {r.retrieval && (
        <div className={styles.retrBox}>
          <p className={styles.cardTitle}>Retrieval trace</p>
          <ul className={styles.chunkList}>
            {r.retrieval.chunks_used.map(c => (
              <li key={c.chunk_id} className={styles.chunkItem}>
                <span className={styles.srcSection}>{c.section}</span>
                <span>chunk #{c.chunk_id}</span>
                <span className={styles.chunkScore}>{(c.score * 100).toFixed(0)}% match</span>
              </li>
            ))}
          </ul>
          {r.retrieval.note && <p className={styles.retrNote}>{r.retrieval.note}</p>}
          {r.explanation?.note && <p className={styles.retrNote}>{r.explanation.note}</p>}
        </div>
      )}
    </div>
  );
}

// ── Unsure: candidates + distinguishing question ─────────────────────────────

export function UnsurePanel({ r, onConfirm, busy, onRetake }: {
  r: RetrievalResult; onConfirm: (diseaseId: string) => void; busy: boolean; onRetake: () => void;
}) {
  if (r.unsure_reason === 'out_of_distribution') {
    return (
      <div className={styles.cardStack}>
        <p className={styles.tBody}>{r.message}</p>
        <button className={styles.primaryBtn} onClick={onRetake}>Retake the photo</button>
      </div>
    );
  }
  return (
    <div className={styles.cardStack}>
      {r.question && (
        <div className={styles.questionCard}>
          <span className={styles.questionMark}>?</span>
          <p className={styles.questionText}>{r.question}</p>
        </div>
      )}
      <h2 className={styles.sectionTitle}>Candidates — pick the one that matches your leaf</h2>
      <ul className={styles.candPanel}>
        {r.candidates.map((c, i) => {
          const pct = c.confidence != null ? Math.round(c.confidence * 100) : null;
          return (
            <li key={c.disease_id} className={styles.candItem}>
              <div className={styles.candHead}>
                <div>
                  <p className={styles.candName}>{c.common_name} <span className={styles.candCrop}>· {c.crop}</span></p>
                  <p className={styles.candConf}>
                    {pct != null ? `${pct}% model confidence` : 'known look-alike (not ranked by the model)'}
                    {i === 0 && ' · model\'s first choice'}
                  </p>
                </div>
                <button className={styles.confirmBtn} onClick={() => onConfirm(c.disease_id)} disabled={busy}>
                  {busy ? '…' : 'This matches'}
                </button>
              </div>
              {c.symptoms ? (
                <ul className={styles.symptomList}>
                  {sentences(c.symptoms).slice(0, 3).map((s, j) => (
                    <li key={j} className={styles.symptom}><span className={styles.symDot} />{s}</li>
                  ))}
                </ul>
              ) : <p className={styles.noData}>Healthy foliage: no spots, lesions, curling or discolouration.</p>}
            </li>
          );
        })}
      </ul>
      <p className={styles.cardHint}>Confirming re-runs the retriever with that disease so you get its full treatment plan. Not sure? Retake the photo: one leaf, filling the frame, in daylight.</p>
    </div>
  );
}

// ── Healthy: care guidance ───────────────────────────────────────────────────

export function HealthyPanel({ r }: { r: RetrievalResult }) {
  const care = r.care;
  return (
    <div className={styles.careGrid}>
      <div className={styles.careCard}>
        <p className={styles.careTitle}>🌱 Keep it healthy</p>
        <p className={styles.careText}>{care?.care_notes || 'No crop-specific care notes on file.'}</p>
      </div>
      <div className={styles.careCard}>
        <p className={styles.careTitle}>👀 Watch for</p>
        <p className={styles.careText}>{care?.watch_for || 'Check leaves every few days for spots, curling or discolouration.'}</p>
      </div>
    </div>
  );
}

// ── Fallback: built-in client KB (classes the retriever doesn't cover) ───────

export function FallbackKbPanel({ kb }: { kb: DiseaseInfo }) {
  const [tab, setTab] = useState<'chemical' | 'organic' | 'prevention'>('chemical');
  const items = kb.treatments[tab];
  return (
    <>
      {kb.symptoms.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Symptoms</h2>
          <ul className={styles.symptomList}>
            {kb.symptoms.map((s, i) => <li key={i} className={styles.symptom}><span className={styles.symDot} />{s}</li>)}
          </ul>
        </div>
      )}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Treatment plan (built-in)</h2>
        <div className={styles.tabs}>
          {(['chemical', 'organic', 'prevention'] as const).map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className={styles.tabCount}>{kb.treatments[t].length}</span>
            </button>
          ))}
        </div>
        <div className={styles.tabContent}>
          {items.length > 0 ? (
            <ol className={styles.stepList}>
              {items.map((item, i) => (
                <li key={i} className={styles.stepItem}><span className={styles.stepNum}>{i + 1}</span><span>{item}</span></li>
              ))}
            </ol>
          ) : <p className={styles.noData}>No {tab} treatment data for this disease.</p>}
        </div>
        <p className={styles.cardHint}>Built-in guidance carries no evidence tier. Confirm doses on the product label or with an extension officer.</p>
      </div>
    </>
  );
}
