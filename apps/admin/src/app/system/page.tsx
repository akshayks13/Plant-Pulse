'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getLogs } from '@/lib/api';
import styles from './system.module.css';

type Log = { id: string; level: string; message: string; source: string; created_at: string; };
const LEVELS = ['ALL', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

export default function SystemPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('plant_pulse_admin_token')) { router.push('/login'); return; }
    (async () => {
      setLoading(true);
      try {
        const data = await getLogs(1, 100, level === 'ALL' ? undefined : level) as { items: Log[] } | Log[];
        setLogs(Array.isArray(data) ? data : (data as { items: Log[] }).items || []);
      } catch { setLogs([]); }
      finally { setLoading(false); }
    })();
  }, [level, router]);

  const filtered = logs.filter(l => l.message.toLowerCase().includes(search.toLowerCase()) || l.source.toLowerCase().includes(search.toLowerCase()));

  function levelIcon(l: string) {
    if (l === 'ERROR' || l === 'CRITICAL') return '🔴';
    if (l === 'WARNING') return '🟡';
    return '🟢';
  }

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>System Logs</h1>
            <p className={styles.sub}>Live platform activity & error monitoring</p>
          </div>
          <div className={styles.liveChip}>
            <span className={styles.liveDot} />
            Live
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.levelTabs}>
            {LEVELS.map(l => (
              <button key={l} className={`${styles.levelTab} ${level === l ? styles.levelActive : ''}`} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input className={`input ${styles.search}`} placeholder="Filter logs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className={styles.logList}>
          {loading ? (
            <div className={styles.loadWrap}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No logs found matching your filters.</div>
          ) : filtered.map((log, i) => (
            <div key={log.id} className={`${styles.logRow} ${styles[`level${log.level}`]}`} style={{ animationDelay: `${i * 0.02}s` }}>
              <span className={styles.logIcon}>{levelIcon(log.level)}</span>
              <span className={`badge badge-${log.level.toLowerCase()}`}>{log.level}</span>
              <span className={styles.logSource}>{log.source}</span>
              <span className={styles.logMsg}>{log.message}</span>
              <span className={styles.logTime}>{new Date(log.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
