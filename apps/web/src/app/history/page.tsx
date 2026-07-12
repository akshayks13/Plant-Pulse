'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getLocalScans, type MockScan } from '@/lib/mockDiagnosis';
import styles from './history.module.css';

function formatName(n: string) {
  return n.replace(/___/g, ' · ').replace(/_/g, ' ');
}

const SEV_COLOR: Record<string, string> = {
  low: '#00e87a', moderate: '#f5c542', high: '#ff8c42', critical: '#ff4a6b',
};

export default function HistoryPage() {
  const router = useRouter();
  const [scans, setScans] = useState<MockScan[]>([]);

  useEffect(() => {
    setScans(getLocalScans());
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={`container ${styles.inner}`}>

        <div className={styles.header}>
          <h1 className={styles.title}>Scan history</h1>
          <p className={styles.sub}>
            {scans.length > 0
              ? `${scans.length} scan${scans.length !== 1 ? 's' : ''}`
              : 'All your past plant diagnoses'}
          </p>
        </div>

        {scans.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🌱</div>
            <h3>No scans yet</h3>
            <p>Upload your first plant photo to get a diagnosis.</p>
            <button className={styles.emptyBtn} onClick={() => router.push('/scan')}>
              Scan a plant
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {scans.map((s, i) => {
              const pct = Math.round(s.confidence * 100);
              const sev = s.severity || 'moderate';
              return (
                <div
                  key={s.id}
                  className={styles.card}
                  onClick={() => router.push(`/results/${s.id}`)}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className={styles.thumb}>
                    {s.image_url ? (
                      <Image src={s.image_url} alt="scan" fill style={{ objectFit: 'cover' }} />
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
