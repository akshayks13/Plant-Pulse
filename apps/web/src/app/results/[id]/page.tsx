'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getDiagnosis, mediaUrl, type Diagnosis } from '@/lib/api';
import { getLocalScan, type MockScan } from '@/lib/mockDiagnosis';
import { getDiseaseInfo, formatDiseaseName } from '@/lib/diseaseKb';
import styles from './results.module.css';

type ScanData = Diagnosis | MockScan;

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'chemical' | 'organic' | 'prevention'>('chemical');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const diag = await getDiagnosis(id);
        if (!cancelled) setData(diag);
      } catch {
        const local = getLocalScan(id);
        if (!cancelled) setData(local || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.emptyState}>
          <p>Loading result…</p>
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className={styles.centered}>
      <div className={styles.emptyState}>
        <span>🌱</span>
        <p>Result not found.</p>
        <button className={styles.outlineBtn} onClick={() => router.push('/scan')}>Scan again</button>
      </div>
    </div>
  );

  const kb = getDiseaseInfo(data.disease_name);
  const displayName = kb ? kb.commonName : formatDiseaseName(data.disease_name);
  const plant = kb ? kb.plant : (data.disease_name.split('___')[0]?.replace(/_/g, ' ') || 'Plant');
  const confPct = Math.round(data.confidence * 100);
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference * (1 - confPct / 100);
  const img = mediaUrl(data.image_url);

  const severityColors: Record<string, string> = {
    low: '#00e87a', moderate: '#f5c542', high: '#ff8c42', critical: '#ff4a6b',
  };
  const sevColor = severityColors[data.severity] || '#f5c542';

  const treatments = {
    chemical: kb?.treatments.chemical || [],
    organic: kb?.treatments.organic || [],
    prevention: kb?.treatments.prevention || [],
  };

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

        <div className={styles.grid}>

          <div className={styles.left}>
            <div className={styles.imgCard}>
              {img ? (
                <Image src={img} alt="Plant scan" fill style={{ objectFit: 'cover' }} unoptimized />
              ) : (
                <span className={styles.imgPlaceholder}>🌿</span>
              )}
            </div>

            <div className={styles.metaCard}>
              <svg width="96" height="96" viewBox="0 0 100 100">
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
                    {data.severity}
                  </span>
                </div>
                {kb && (
                  <>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Pathogen</span>
                      <span className={styles.metaVal}>{kb.pathogen}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Type</span>
                      <span className={styles.metaVal}>{kb.pathogenType}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Spread</span>
                      <span className={styles.metaVal}>{kb.spreadRate}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button className={styles.outlineBtn} onClick={() => router.push('/scan')}>
              Scan another plant
            </button>
          </div>

          <div className={styles.right}>
            <div className={styles.diseaseHeader}>
              <span className={styles.plantChip}>{plant}</span>
              <h1 className={styles.diseaseName}>
                {data.is_healthy ? (
                  <><span className={styles.healthyAccent}>Healthy</span> plant 🌿</>
                ) : displayName}
              </h1>
              {kb && <p className={styles.pathogenSub}><em>{kb.pathogen}</em></p>}
            </div>

            {kb && kb.symptoms.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Symptoms</h2>
                <ul className={styles.symptomList}>
                  {kb.symptoms.map((s, i) => (
                    <li key={i} className={styles.symptom}>
                      <span className={styles.symDot} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Treatment plan</h2>
              <div className={styles.tabs}>
                {(['chemical','organic','prevention'] as const).map(t => (
                  <button
                    key={t}
                    className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'chemical' ? 'Chemical' : t === 'organic' ? 'Organic' : 'Prevention'}
                  </button>
                ))}
              </div>
              <div className={styles.tabContent}>
                {treatments[tab].length > 0 ? (
                  <ol className={styles.treatList}>
                    {treatments[tab].map((item, i) => (
                      <li key={i} className={styles.treatItem}>
                        <span className={styles.treatNum}>{i + 1}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.noData}>No {tab} treatment data available for this disease.</p>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <button className={styles.outlineBtn} onClick={() => router.push('/history')}>View all scans</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
