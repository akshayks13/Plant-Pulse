'use client';
/**
 * Presentational pieces of the results page. Each one renders a slice of the
 * backend's Diagnosis (CNN step) or the retrieval service's payload.
 */
import { useState } from 'react';
import type { Candidate, Diagnosis, DiyRemedy, Explanation, ProductGroup, RetrievalResult, Treatment } from '@/lib/api';
import type { DiseaseInfo } from '@/lib/diseaseKb';
import {
  CONTROL_CLASS_COLOR, RESULT_META, RETRIEVAL_STATUS_META, TIER_META,
  formatDose, prettyLabel, sentences,
} from '@/lib/pipeline';
import styles from './results.module.css';

// ── Pipeline strip (top of page) ─────────────────────────────────────────────

export function PipelineStrip({ data }: { data: Diagnosis }) {
  const ok = data.retrieval_status === 'ok' && data.retrieval;
  const type = ok ? data.retrieval!.result_type : null;
  const status = RETRIEVAL_STATUS_META[data.retrieval_status];
  const retrState = ok ? 'done' : data.retrieval_status === 'pending' ? 'todo' : 'warn';

  const nodes = [
    { title: 'Photo', sub: 'Uploaded', state: 'done' as const, color: '#00e87a' },
    {
      title: 'Identified as',
      sub: `${prettyLabel(data.disease_name)} · ${Math.round(data.confidence * 100)}%`,
      state: 'done' as const, color: '#00e87a',
    },
    {
      title: 'Treatment plan',
      sub: ok && type ? `Ready · ${RESULT_META[type].label}` : status.label,
      state: retrState as 'done' | 'todo' | 'warn',
      color: ok && type ? RESULT_META[type].color : status.color,
    },
  ];

  return (
    <div className={styles.strip} aria-label="Scan progress">
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
      <h3 className={styles.cardTitle}>Top matches</h3>
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
            {st === 'unsupported_class' ? 'General guidance'
              : st === 'pending' ? 'Treatment plan not loaded yet'
              : 'Treatment plan unavailable'}
          </p>
          <p className={styles.bannerText}>
            {st === 'unsupported_class' ? "We don't have a full treatment plan for this plant yet, so here is some general guidance."
              : st === 'pending' ? 'Press Retry to load the treatment plan.'
              : "We couldn't load the treatment plan right now. Please try again in a moment."}
          </p>
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

// ── Small text helpers ───────────────────────────────────────────────────────

// A sentence is a warning if it starts with "Do not / Never / Avoid", or is about
// leaves that people eat. Warnings go in a "Be careful" box; everything else is a step.
const CAUTION_WORDS = /^(do not|never|avoid)\b|eaten|chewed/i;

function isCaution(sentence: string) {
  return CAUTION_WORDS.test(sentence);
}

// "Prune dead twigs: Cut out dead shoots." -> { title: "Prune dead twigs", text: "Cut out dead shoots." }
function splitTitle(line: string) {
  const at = line.indexOf(': ');
  if (at === -1 || at > 80) return { title: '', text: line };
  return { title: line.slice(0, at), text: line.slice(at + 2) };
}

// The retriever writes "why it happened" with fixed phrases, so we turn them into labels.
const WHY_LABELS = [
  { phrase: 'develops under these conditions:', label: 'Conditions', icon: '🌦️' },
  { phrase: 'It spreads as follows:', label: 'How it spreads', icon: '💨' },
  { phrase: 'The pathogen survives between seasons in:', label: 'Where it survives', icon: '🍂' },
  { phrase: 'It is transmitted by', label: 'Carried by', icon: '🪰' },
];

function labelWhySentence(sentence: string) {
  for (const w of WHY_LABELS) {
    const at = sentence.indexOf(w.phrase);
    if (at !== -1) {
      const text = sentence.slice(at + w.phrase.length).trim();
      return { label: w.label, icon: w.icon, text: text.charAt(0).toUpperCase() + text.slice(1) };
    }
  }
  return { label: 'Good to know', icon: 'ℹ️', text: sentence };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function siteName(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// ── Overview: what is it + why did it happen ─────────────────────────────────

export function OverviewCard({ e }: { e: Explanation }) {
  // Symptoms have their own section below, so we drop that sentence here.
  const summary = sentences(e.summary).filter(s => !s.startsWith('Symptoms:'));
  const why = sentences(e.why_it_happened).map(labelWhySentence);

  return (
    <div className={styles.overview}>
      <div>
        <h3 className={styles.blockTitle}>What is it?</h3>
        {summary.map((s, i) => <p key={i} className={styles.overviewText}>{s}</p>)}
      </div>

      {why.length > 0 && (
        <div>
          <h3 className={styles.blockTitle}>Why did it happen?</h3>
          <div className={styles.factGrid}>
            {why.map((w, i) => (
              <div key={i} className={styles.fact}>
                <span className={styles.factIcon}>{w.icon}</span>
                <div>
                  <p className={styles.factLabel}>{w.label}</p>
                  <p className={styles.factText}>{w.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Action plan: treatments grouped by what kind of step they are ────────────

const PLAN_GROUPS = [
  { title: 'Start here: care and hygiene', hint: 'Free steps that do the most good.', icon: '✂️', classes: ['cultural', 'physical'] },
  { title: 'Sprays you can buy', hint: 'Use these if the disease keeps spreading.', icon: '🧪', classes: ['chemical'] },
  { title: 'Biological options', hint: 'Friendly microbes and plant extracts.', icon: '🌱', classes: ['biological'] },
];

export function ActionPlan({ r, onShowProducts }: { r: RetrievalResult; onShowProducts: () => void }) {
  const incurable = r.result_type === 'incurable';
  const hasProducts = (r.product_groups || []).length > 0;

  if (r.treatments.length === 0) {
    return <p className={styles.noData}>No treatment steps are on file for this disease.</p>;
  }

  return (
    <div className={styles.cardStack}>
      {PLAN_GROUPS.map(group => {
        const items = r.treatments.filter(t => group.classes.includes(t.control_class));
        if (items.length === 0) return null;

        const title = incurable && group.classes.includes('cultural') ? 'Remove and contain' : group.title;
        return (
          <section key={group.title} className={styles.planGroup}>
            <div className={styles.planHead}>
              <span className={styles.planIcon}>{group.icon}</span>
              <div>
                <h3 className={styles.planTitle}>{title}</h3>
                <p className={styles.planHint}>{group.hint}</p>
              </div>
            </div>
            {items.map((t, i) => (
              <TreatmentCard
                key={t.treatment_id}
                t={t}
                index={i}
                onShowProducts={hasProducts && t.active_ingredient ? onShowProducts : undefined}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ── One treatment step ───────────────────────────────────────────────────────

export function TreatmentCard({ t, index, onShowProducts }: {
  t: Treatment; index: number; onShowProducts?: () => void;
}) {
  const tier = TIER_META[t.source_tier] || TIER_META.none;
  const dose = formatDose(t);

  // Split the instructions into short "do this" bullets and "be careful" warnings.
  const lines = sentences(t.instructions);
  const steps = lines.filter(line => !isCaution(line));
  const cautions = lines.filter(isCaution);
  if (t.hazard_notes) cautions.push(t.hazard_notes);

  return (
    <article className={styles.tCard}>
      <div className={styles.tHead}>
        <span className={styles.tNum}>{index + 1}</span>
        <div className={styles.tHeadText}>
          <h4 className={styles.tTitle}>{t.title}</h4>
          {t.active_ingredient && (
            <p className={styles.tAi}>Active ingredient · <b>{t.active_ingredient}</b></p>
          )}
          <div className={styles.tChips}>
            {t.organic_approved && <span className={styles.chip} style={{ color: '#00e87a', borderColor: '#00e87a40', background: '#00e87a12' }}>organic-approved</span>}
          </div>
        </div>
      </div>

      {t.active_ingredient && (
        <div className={styles.doseRow} style={{ borderColor: `${tier.color}35` }}>
          {/* A dose number is always shown with its badge (registered or research-suggested). */}
          {dose ? (
            <>
              <span className={styles.tierBadge} style={{ color: tier.color, background: `${tier.color}14` }} title={tier.hint}>
                {tier.label}
              </span>
              <span className={styles.doseVal}>{dose}</span>
            </>
          ) : (
            <span className={styles.doseNone}><b>Dose:</b> follow the product label.</span>
          )}
          {t.interval_days != null && <span className={styles.doseMeta}>every {t.interval_days} days</span>}
          {t.phi_days != null && <span className={styles.doseMeta}>wait {t.phi_days} days before harvest</span>}
        </div>
      )}

      {steps.length > 0 && (
        <ul className={styles.tSteps}>
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}

      {cautions.length > 0 && (
        <div className={styles.caution}>
          <p className={styles.cautionTitle}>⚠ Be careful</p>
          <ul>
            {cautions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {(onShowProducts || t.source_name || t.source_url) && (
        <div className={styles.tFoot}>
          {(t.source_name || t.source_url) && (
            <span className={styles.srcLine}>
              Source · {t.source_url
                ? <a href={t.source_url} target="_blank" rel="noreferrer">{t.source_name || siteName(t.source_url)}</a>
                : t.source_name}
            </span>
          )}
          {onShowProducts && (
            <button className={styles.linkBtn} onClick={onShowProducts}>See products with {t.active_ingredient} →</button>
          )}
        </div>
      )}
    </article>
  );
}

// ── Prevention ───────────────────────────────────────────────────────────────

export function PreventionList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className={styles.noData}>No separate prevention notes; the action plan covers it.</p>;
  }
  return (
    <div className={styles.preventGrid}>
      {items.map((line, i) => {
        const { title, text } = splitTitle(line);
        return (
          <div key={i} className={styles.preventCard}>
            <span className={styles.preventIcon}>🛡️</span>
            <div>
              {title && <p className={styles.preventTitle}>{title}</p>}
              <p className={styles.preventText}>{text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Home remedy (DIY) card with step-by-step instructions ────────────────────

export function DiyCard({ d }: { d: DiyRemedy }) {
  let efficacy = { label: d.efficacy.replace(/_/g, ' '), color: '#8fab98' };
  if (d.efficacy === 'preventive') efficacy = { label: 'Prevents spread', color: '#f5c542' };
  if (d.efficacy === 'mild_curative') efficacy = { label: 'Mildly curative', color: '#00e87a' };

  const ingredients = Array.isArray(d.ingredients) ? d.ingredients : [];
  const steps = sentences(d.steps);

  let prepTime = '';
  if (d.prep_time_hours != null) {
    prepTime = d.prep_time_hours < 1 ? `${Math.round(d.prep_time_hours * 60)} min` : `${d.prep_time_hours} h`;
  }

  return (
    <article className={styles.diyCard}>
      <div className={styles.diyHead}>
        <div>
          <h4 className={styles.diyTitle}>{d.title}</h4>
          <div className={styles.diyMeta}>
            {prepTime && <span>⏱ {prepTime} to make</span>}
            {d.feasibility_score != null && (
              <span className={styles.feas} title={`Ease ${d.feasibility_score}/5`}>
                Ease {[1, 2, 3, 4, 5].map(n => (
                  <i key={n} className={`${styles.feasDot} ${n <= (d.feasibility_score || 0) ? styles.feasDotOn : ''}`} />
                ))}
              </span>
            )}
          </div>
        </div>
        <span className={styles.chip} style={{ color: efficacy.color, borderColor: `${efficacy.color}40`, background: `${efficacy.color}12` }}>
          {efficacy.label}
        </span>
      </div>

      <div className={styles.diyBody}>
        <div className={styles.diyNeed}>
          <p className={styles.blockTitle}>You&apos;ll need</p>
          <ul className={styles.needList}>
            {ingredients.map((ing, i) => (
              <li key={i} className={styles.needItem}>
                <span className={styles.needQty}>{ing.quantity != null ? `${ing.quantity} ${ing.unit || ''}` : '—'}</span>
                <span className={styles.needName}>{ing.item}</span>
                {ing.home_available && <i className={styles.diyIngHome}>at home</i>}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={styles.blockTitle}>Steps</p>
          <ol className={styles.stepFlow}>
            {steps.map((s, i) => (
              <li key={i} className={styles.stepFlowItem}>
                <span className={styles.stepFlowNum}>{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {d.safety_notes && (
        <div className={styles.caution}>
          <p className={styles.cautionTitle}>⚠ Safety</p>
          <ul>
            {sentences(d.safety_notes).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      <p className={styles.diyHonesty}>{d.honesty_note}</p>
      {d.source_url && (
        <p className={styles.srcLine}>
          Recipe source · <a href={d.source_url} target="_blank" rel="noreferrer">{siteName(d.source_url)}</a>
        </p>
      )}
    </article>
  );
}

// ── Products to buy, grouped by active ingredient ────────────────────────────

export function ProductsPanel({ r }: { r: RetrievalResult }) {
  const groups = r.product_groups || [];

  return (
    <div className={styles.cardStack}>
      {groups.length > 0 ? (
        <p className={styles.prodIntro}>
          These products contain the active ingredients in your action plan. We found them by web search
          {r.catalog_retrieved_on ? ` on ${formatDate(r.catalog_retrieved_on)}` : ''}. Prices change every day,
          so use <b>Compare prices</b>{' '}to see today&apos;s offers.
        </p>
      ) : (
        <p className={styles.prodNote}>{r.product_note || 'No products are suggested for this result.'}</p>
      )}

      {groups.map(g => <ProductGroupCard key={g.ingredient} g={g} />)}

      {/* Live shop listings, only when the optional SERPER_API_KEY is set on the retrieval service */}
      {r.products.length > 0 && (
        <section className={styles.prodGroup}>
          <h3 className={styles.prodGroupTitle}>Live listings for {r.product_ingredient}</h3>
          <ul className={styles.prodList}>
            {r.products.map((p, i) => (
              <li key={i} className={styles.prodCard}>
                <div className={styles.prodMain}>
                  <span className={styles.prodName}>{p.name}</span>
                  <span className={styles.prodMeta}>{p.vendor}{p.concentration ? ` · ${p.concentration}` : ''}</span>
                </div>
                <div className={styles.prodSide}>
                  {p.price_text && <span className={styles.prodPrice}>{p.price_text}</span>}
                  {p.url && <a className={styles.smallBtn} href={p.url} target="_blank" rel="noreferrer">View</a>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length > 0 && (
        <div className={styles.labelReminder}>
          <span>📋</span>
          <p>Before you buy, check that the label lists your plant. Always follow the label&apos;s dose and its waiting period before harvest.</p>
        </div>
      )}
    </div>
  );
}

function ProductGroupCard({ g }: { g: ProductGroup }) {
  const cc = CONTROL_CLASS_COLOR[g.control_class] || '#8fab98';

  return (
    <section className={styles.prodGroup}>
      <div className={styles.prodGroupHead}>
        <div>
          <p className={styles.prodGroupLabel}>Contains</p>
          <h3 className={styles.prodGroupTitle}>{g.ingredient}</h3>
          <p className={styles.prodGroupFor}>Used for: {g.used_for}</p>
        </div>
        <div className={styles.tChips}>
          <span className={styles.chip} style={{ color: cc, borderColor: `${cc}40`, background: `${cc}12` }}>{g.control_class}</span>
          {g.organic_approved && <span className={styles.chip} style={{ color: '#00e87a', borderColor: '#00e87a40', background: '#00e87a12' }}>organic-approved</span>}
        </div>
      </div>

      {g.products.length > 0 ? (
        <div className={styles.prodGrid}>
          {g.products.map(p => (
            <article key={p.name} className={styles.prodTile}>
              <div className={styles.prodTileTop}>
                <span className={styles.prodBadge}>{p.name.charAt(0)}</span>
                <div>
                  <p className={styles.prodName}>{p.name}</p>
                  <p className={styles.prodMaker}>by {p.maker}</p>
                </div>
              </div>
              <span className={styles.formChip}>{p.formulation}</span>
              {p.note && <p className={styles.prodTileNote}>{p.note}</p>}
              <div className={styles.prodActions}>
                <a className={styles.prodBtnPrimary} href={p.shop_url} target="_blank" rel="noreferrer">Compare prices</a>
                {p.seller_url && <a className={styles.prodBtn} href={p.seller_url} target="_blank" rel="noreferrer">Shop</a>}
                <a className={styles.prodBtn} href={p.product_url} target="_blank" rel="noreferrer">Details</a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.prodNote}>
          No product is on file for this ingredient yet.{' '}
          <a href={g.search_url} target="_blank" rel="noreferrer">Search shops for {g.ingredient}</a>
        </p>
      )}
    </section>
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
                <p className={styles.srcTitle}>{c.title || 'Reference'}</p>
                <p className={styles.srcName}>
                  {c.source_url
                    ? <a href={c.source_url} target="_blank" rel="noreferrer">{c.source_name || c.source_url}</a>
                    : (c.source_name === 'curated_kb' ? 'Plant-Pulse plant guide' : c.source_name)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className={styles.noData}>No citations were recorded for this answer.</p>}

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
                    {pct != null ? `${pct}% match` : 'Looks similar'}
                    {i === 0 && ' · best guess'}
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
      <p className={styles.cardHint}>Pick the one that matches to see its full treatment plan. Not sure? Retake the photo: one leaf, filling the frame, in daylight.</p>
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
