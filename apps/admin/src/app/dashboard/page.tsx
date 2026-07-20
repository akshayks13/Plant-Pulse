'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getStats } from '@/lib/api';
import styles from './dashboard.module.css';

type Stats = {
  total_users: number;
  total_diagnoses: number;
  active_users_today: number;
  diagnoses_today: number;
  top_diseases: { name: string; count: number }[];
  system_health: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('plant_pulse_admin_token');
    if (!token) { router.push('/login'); return; }
    (async () => {
      try { setStats(await getStats() as Stats); }
      catch { /* stats may be partially loaded */ }
      finally { setLoading(false); }
    })();
  }, [router]);

  const metrics = stats ? [
    { label: 'Total Users', value: stats.total_users, icon: '👥', color: '#00e87a', delta: '+12%' },
    { label: 'Total Diagnoses', value: stats.total_diagnoses, icon: '🔬', color: '#00b4d8', delta: '+8%' },
    { label: 'Active Today', value: stats.active_users_today, icon: '⚡', color: '#f5c542', delta: '+3' },
    { label: 'Scans Today', value: stats.diagnoses_today, icon: '📊', color: '#ff8c42', delta: '+18%' },
  ] : [];

  const maxCount = stats?.top_diseases?.length ? Math.max(...stats.top_diseases.map(d => d.count), 1) : 1;

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.sub}>Real-time overview of Plant-Pulse platform.</p>
          </div>
          <div className={`${styles.healthBadge} ${stats?.system_health === 'healthy' ? styles.healthOk : styles.healthBad}`}>
            <span className={styles.healthDot} />
            {stats?.system_health || 'Checking…'}
          </div>
        </div>

        {loading ? (
          <div className={styles.loadWrap}><div className="spinner" /></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className={styles.statsGrid}>
              {metrics.map((m, i) => (
                <div key={m.label} className={styles.statCard} style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className={styles.statTop}>
                    <span className={styles.statIcon}>{m.icon}</span>
                    <span className={styles.statDelta}>{m.delta}</span>
                  </div>
                  <div className={styles.statValue} style={{ color: m.color }}>{m.value?.toLocaleString()}</div>
                  <div className={styles.statLabel}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Top diseases chart */}
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Top Diseases Detected</h2>
                <span className={styles.sectionSub}>All time</span>
              </div>
              {stats?.top_diseases?.length ? (
                <div className={styles.diseaseChart}>
                  {stats.top_diseases.slice(0, 8).map((d, i) => {
                    const pct = Math.round((d.count / maxCount) * 100);
                    return (
                      <div key={d.name} className={styles.chartRow} style={{ animationDelay: `${i * 0.06}s` }}>
                        <span className={styles.chartLabel}>{d.name.replace(/___/g,' — ').replace(/_/g,' ')}</span>
                        <div className={styles.chartBar}>
                          <div
                            className={styles.chartFill}
                            style={{ '--w': `${pct}%`, animationDelay: `${i * 0.08}s` } as React.CSSProperties}
                          />
                        </div>
                        <span className={styles.chartCount}>{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.noData}>No disease data available yet.</p>
              )}
            </div>

            {/* Quick links */}
            <div className={styles.quickLinks}>
              {[
                { href: '/diagnoses', label: 'View all diagnoses', icon: '🔬' },
                { href: '/users', label: 'Manage users', icon: '👥' },
                { href: '/system', label: 'System logs', icon: '⚙' },
              ].map(q => (
                <a key={q.href} href={q.href} className={styles.quickCard}>
                  <span className={styles.quickIcon}>{q.icon}</span>
                  <span className={styles.quickLabel}>{q.label}</span>
                  <span className={styles.quickArrow}>→</span>
                </a>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
