'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getDiagnosisHistory, mediaUrl, isAuthenticated, type Diagnosis } from '@/lib/api';
import { getLocalScans, type MockScan } from '@/lib/mockDiagnosis';
import styles from './history.module.css';

function formatName(n: string) {
  return n.replace(/___/g, ' · ').replace(/_/g, ' ');
}

const SEV_COLOR: Record<string, string> = {
  low: '#00e87a', moderate: '#f5c542', high: '#ff8c42', critical: '#ff4a6b',
};

const FILTERS = ['all', 'low', 'moderate', 'high', 'critical'] as const;

type ScanItem = Diagnosis | MockScan;

export default function HistoryPage() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/auth/login');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getDiagnosisHistory(1, 100);
        if (!cancelled) setScans(data.items || []);
      } catch {
        if (!cancelled) {
          setScans(getLocalScans());
          setError('Showing offline history — backend unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const filtered = useMemo(() => {
    if (filter === 'all') return scans;
    return scans.filter(s => (s.severity || 'moderate') === filter);
  }, [scans, filter]);

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={`container ${styles.inner}`}>

        <div className={styles.header}>
          <h1 className={styles.title}>Scan history</h1>
          <p className={styles.sub}>
            {scans.length > 0
              ? `${filtered.length} of ${scans.length} scan${scans.length !== 1 ? 's' : ''}`
              : 'All your past plant diagnoses'}
          </p>
        </div>

        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && <p className={styles.error} style={{ marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <div className={styles.center}><div className={styles.spinner} /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🌱</div>
            <h3>{scans.length === 0 ? 'No scans yet' : 'No matches'}</h3>
            <p>
              {scans.length === 0
                ? 'Upload your first plant photo to get a diagnosis.'
                : 'Try a different severity filter.'}
            </p>
            {scans.length === 0 && (
              <button className={styles.emptyBtn} onClick={() => router.push('/scan')}>
                Scan a plant
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((s, i) => {
              const pct = Math.round(s.confidence * 100);
              const sev = s.severity || 'moderate';
              const img = mediaUrl(s.image_url);
              return (
                <div
                  key={s.id}
                  className={styles.card}
                  onClick={() => router.push(`/results/${s.id}`)}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className={styles.thumb}>
                    {img ? (
                      <Image src={img} alt="scan" fill style={{ objectFit: 'cover' }} unoptimized />
                    ) : (
                      <span className={styles.thumbPlaceholder}>🌿</span>
                    )}
                    <div className={styles.thumbOverlay} />
                    <span
                      className={styles.sevDot}
                      style={{ background: SEV_COLOR[sev] || '#f5c542' }}
                      title={sev}
                    />
                  </div>
                  <div className={styles.body}>
                    <p className={styles.name}>
                      {s.is_healthy ? '✓ Healthy' : formatName(s.disease_name)}
                    </p>
                    <div className={styles.confRow}>
                      <div className={styles.confBar}>
                        <div className={styles.confFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.confPct}>{pct}%</span>
                    </div>
                    <p className={styles.date}>
                      {new Date(s.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
