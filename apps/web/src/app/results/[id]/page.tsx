'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getDiagnosis, retrieveTreatment, mediaUrl, type Diagnosis } from '@/lib/api';
import { getLocalScan, isMockMode } from '@/lib/mockDiagnosis';
import { getDiseaseInfo } from '@/lib/diseaseKb';
import {
  SEVERITY_COLOR, RESULT_META, RETRIEVAL_STATUS_META,
  modelSourceLabel, displayName, cropName, sentences,
} from '@/lib/pipeline';
import {
  PipelineStrip, CandidatesCard, StatusBanner, ExplanationCard, TreatmentCard,
  DiyCard, ProductsPanel, SourcesPanel, UnsurePanel, HealthyPanel, FallbackKbPanel,
} from './sections';
import styles from './results.module.css';

type Tab = 'treatment' | 'diy' | 'products' | 'prevention' | 'sources';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'retry' | 'confirm' | null>(null);
  const [tab, setTab] = useState<Tab>('treatment');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        if (isMockMode()) {
          if (!cancelled) setData(getLocalScan(id));
          return;
        }
        const diag = await getDiagnosis(id);
        if (!cancelled) setData(diag);
      } catch (err: unknown) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Could not load this result.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  /** Re-run the retrieval step (after an outage). */
  const retry = useCallback(async () => {
    setBusy('retry'); setError('');
    try { setData(await retrieveTreatment(id)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Retry failed.'); }
    finally { setBusy(null); }
  }, [id]);

  /** The user looked at the leaf and picked one of the "unsure" candidates. */
  const confirm = useCallback(async (diseaseId: string) => {
    setBusy('confirm'); setError('');
    try {
      setData(await retrieveTreatment(id, { confirmed_disease_id: diseaseId }));
      setTab('treatment');
    }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not confirm.'); }
    finally { setBusy(null); }
  }, [id]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.emptyState}>
          <div className={styles.loader} />
          <p>Loading result…</p>
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className={styles.centered}>
      <div className={styles.emptyState}>
        <span>🌱</span>
        <p>{error || 'Result not found.'}</p>
        <button className={styles.outlineBtn} onClick={() => router.push('/scan')}>Scan again</button>
      </div>
    </div>
  );

  // ── Derived view state ─────────────────────────────────────────────────
  const r = data.retrieval;
  const ok = data.retrieval_status === 'ok' && !!r;
  const type = ok && r ? r.result_type : null;
  const name = displayName(data);
  const crop = cropName(data);
  const kbFallback = !ok ? getDiseaseInfo(data.disease_name) : null;
  const confPct = Math.round(data.confidence * 100);
  const isHealthy = type === 'healthy' || (!ok && data.is_healthy);
  const sevColor = isHealthy ? SEVERITY_COLOR.low : (SEVERITY_COLOR[data.severity] || '#f5c542');
  const meta = type ? RESULT_META[type] : null;
  const statusMeta = RETRIEVAL_STATUS_META[data.retrieval_status];
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference * (1 - confPct / 100);
  const img = mediaUrl(data.image_url);
  const showTabs = ok && r && (type === 'normal' || type === 'incurable');

  const tabs: { key: Tab; label: string; count: number | null }[] = showTabs && r ? [
    { key: 'treatment',  label: type === 'incurable' ? 'Containment' : 'Treatments', count: r.treatments.length },
    { key: 'diy',        label: 'Home remedies', count: r.diy.length },
    { key: 'products',   label: 'Products',      count: r.products.length },
    { key: 'prevention', label: 'Prevention',    count: r.explanation?.prevention.length ?? 0 },
    { key: 'sources',    label: 'Sources',       count: r.explanation?.citations.length ?? 0 },
  ] : [];

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={`container ${styles.inner}`}>

        <div className={styles.topNav}>
          <button className={styles.backBtn} onClick={() => router.back()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Back
          </button>
          <span className={styles.timestamp}>
            {new Date(data.created_at).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
          </span>
        </div>

        <PipelineStrip data={data} />

        {error && <p className={styles.errorBox}>{error}</p>}

        <div className={styles.grid}>

          {/* ── Left column ─────────────────────────────────────────── */}
          <div className={styles.left}>
            <div className={styles.imgCard}>
              {img ? (
                <Image src={img} alt="Plant scan" fill style={{ objectFit: 'cover' }} unoptimized />
              ) : (
                <span className={styles.imgPlaceholder}>🌿</span>
              )}
            </div>

            <div className={styles.metaCard}>
              <svg width="104" height="104" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none"/>
                <circle
                  cx="50" cy="50" r="42"
                  stroke={sevColor}
                  strokeWidth="8" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                />
                <text x="50" y="46" textAnchor="middle" fill="#f0f7f2" fontSize="18" fontWeight="800" fontFamily="Outfit">{confPct}%</text>
                <text x="50" y="60" textAnchor="middle" fill="rgba(240,247,242,0.4)" fontSize="9" fontFamily="Inter">confidence</text>
              </svg>

              <div className={styles.metaRows}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Severity</span>
                  <span className={styles.metaBadge} style={{ color: sevColor, borderColor: `${sevColor}30`, background: `${sevColor}10` }}>
                    {isHealthy ? 'none' : data.severity}
                  </span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Classifier</span>
                  <span className={styles.metaVal}>{modelSourceLabel(data.model_source)}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Retriever</span>
                  <span className={styles.metaBadge} style={{ color: statusMeta.color, borderColor: `${statusMeta.color}30`, background: `${statusMeta.color}10` }}>
                    {statusMeta.label}
                  </span>
                </div>
                {r?.disease.pathogen && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Pathogen</span>
                    <span className={styles.metaVal} title={r.disease.pathogen}>{r.disease.pathogen}</span>
                  </div>
                )}
                {r?.disease.pathogen_type && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Type</span>
                    <span className={styles.metaVal}>{r.disease.pathogen_type.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {r && !r.disease.is_healthy_class && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Curability</span>
                    <span className={styles.metaVal} style={r.disease.curability === 'incurable' ? { color: '#ff4a6b' } : undefined}>
                      {r.disease.curability}
                    </span>
                  </div>
                )}
                {!r && kbFallback && (
                  <>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Pathogen</span>
                      <span className={styles.metaVal}>{kbFallback.pathogen}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Type</span>
                      <span className={styles.metaVal}>{kbFallback.pathogenType}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {data.candidates.length > 0 && <CandidatesCard candidates={data.candidates} />}

            <button className={styles.outlineBtn} onClick={() => router.push('/scan')}>
              Scan another plant
            </button>
          </div>

          {/* ── Right column ────────────────────────────────────────── */}
          <div className={styles.right}>

            <div className={styles.diseaseHeader}>
              <div className={styles.chipRow}>
                <span className={styles.plantChip}>{crop}</span>
                {meta && (
                  <span className={styles.typeChip} style={{ color: meta.color, borderColor: `${meta.color}35`, background: `${meta.color}12` }}>
                    {meta.icon} {meta.label}
                  </span>
                )}
                {data.confirmed_disease_id && (
                  <span className={styles.confirmedChip}>Confirmed by you</span>
                )}
              </div>
              <h1 className={styles.diseaseName}>
                {isHealthy ? (
                  <><span className={styles.healthyAccent}>Healthy</span> {crop.toLowerCase()} 🌿</>
                ) : name}
              </h1>
              {r?.disease.pathogen && !isHealthy && r.disease.pathogen.toLowerCase() !== name.toLowerCase() && (
                <p className={styles.pathogenSub}><em>{r.disease.pathogen}</em></p>
              )}
              {!r && kbFallback && !isHealthy && (
                <p className={styles.pathogenSub}><em>{kbFallback.pathogen}</em></p>
              )}
            </div>

            <StatusBanner data={data} onRetry={retry} busy={busy === 'retry'} />

            {/* Retrieval didn't answer: built-in guidance where we have it */}
            {!ok && (
              kbFallback
                ? <FallbackKbPanel kb={kbFallback} />
                : data.retrieval_status !== 'pending' && (
                    <p className={styles.noData}>No treatment guidance is available for this class yet.</p>
                  )
            )}

            {ok && r && type === 'unsure' && (
              <UnsurePanel r={r} onConfirm={confirm} busy={busy === 'confirm'} onRetake={() => router.push('/scan')} />
            )}

            {ok && r && type === 'healthy' && <HealthyPanel r={r} />}

            {showTabs && r && (
              <>
                {r.explanation && <ExplanationCard e={r.explanation} />}

                {r.disease.symptoms && (
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Symptoms</h2>
                    <ul className={styles.symptomList}>
                      {sentences(r.disease.symptoms).map((s, i) => (
                        <li key={i} className={styles.symptom}><span className={styles.symDot} />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className={styles.section}>
                  <div className={styles.tabs} role="tablist">
                    {tabs.map(t => (
                      <button
                        key={t.key}
                        role="tab"
                        aria-selected={tab === t.key}
                        className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
                        onClick={() => setTab(t.key)}
                      >
                        {t.label}
                        {t.count != null && <span className={styles.tabCount}>{t.count}</span>}
                      </button>
                    ))}
                  </div>

                  <div className={styles.tabContent}>
                    {tab === 'treatment' && (
                      <div className={styles.cardStack}>
                        {r.explanation && r.explanation.treatment_steps.length > 0 && (
                          <ol className={styles.stepList}>
                            {r.explanation.treatment_steps.map((s, i) => (
                              <li key={i} className={styles.stepItem}><span className={styles.stepNum}>{i + 1}</span><span>{s}</span></li>
                            ))}
                          </ol>
                        )}
                        {r.treatments.length > 0
                          ? r.treatments.map((t, i) => <TreatmentCard key={t.treatment_id} t={t} index={i} />)
                          : <p className={styles.noData}>No treatment rows on file for this disease.</p>}
                      </div>
                    )}

                    {tab === 'diy' && (
                      <div className={styles.cardStack}>
                        {r.diy.length > 0
                          ? r.diy.map(d => <DiyCard key={d.diy_id} d={d} />)
                          : <p className={styles.noData}>No home-made remedy is recorded for this disease. That is deliberate: the knowledge base only lists remedies with a known effect.</p>}
                      </div>
                    )}

                    {tab === 'products' && <ProductsPanel r={r} />}

                    {tab === 'prevention' && (
                      r.explanation && r.explanation.prevention.length > 0 ? (
                        <ul className={styles.symptomList}>
                          {r.explanation.prevention.map((p, i) => (
                            <li key={i} className={styles.symptom}><span className={styles.symDot} />{p}</li>
                          ))}
                        </ul>
                      ) : <p className={styles.noData}>No separate prevention notes; the containment steps above cover it.</p>
                    )}

                    {tab === 'sources' && <SourcesPanel r={r} />}
                  </div>
                </div>
              </>
            )}

            {r?.disclaimer && <p className={styles.disclaimer}>{r.disclaimer}</p>}

            <div className={styles.footer}>
              <button className={styles.outlineBtn} onClick={() => router.push('/history')}>View all scans</button>
              <button className={styles.outlineBtn} onClick={() => router.push('/community')}>Ask the community</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
