'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import { getDiagnoses } from '@/lib/api';
import styles from './diagnoses.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Diagnosis = {
  id: string;
  disease_name: string;
  confidence: number;
  severity: string;
  image_url: string;
  created_at: string;
  is_healthy: boolean;
  user_id: string;
  user_email?: string;
};

export default function DiagnosesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!localStorage.getItem('plant_pulse_admin_token')) { router.push('/login'); return; }
    (async () => {
      setLoading(true);
      try {
        const data = await getDiagnoses(page, PAGE_SIZE) as { items: Diagnosis[]; total: number };
        setItems(Array.isArray(data) ? data : data.items || []);
        setTotal(typeof data === 'object' && 'total' in data ? data.total : 0);
      } catch { setItems([]); }
      finally { setLoading(false); }
    })();
  }, [page, router]);

  const filtered = items.filter(d =>
    d.disease_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.user_email || '').toLowerCase().includes(search.toLowerCase())
  );

  function getImageUrl(url: string) {
    if (!url) return null;
    return url.startsWith('http') ? url : `${BASE_URL}${url}`;
  }

  function formatName(n: string) {
    return n.replace(/___/g, ' — ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Diagnoses</h1>
            <p className={styles.sub}>{total} total scans across all users</p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input className={`input ${styles.search}`} placeholder="Search disease or user…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Image</th>
                <th>Disease</th>
                <th>Confidence</th>
                <th>Severity</th>
                <th>User</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className={styles.loadCell}><div className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className={styles.emptyCell}>No diagnoses found.</td></tr>
              ) : filtered.map((d, i) => {
                const imgUrl = getImageUrl(d.image_url);
                return (
                  <tr key={d.id} className={styles.row} style={{ animationDelay: `${i * 0.03}s` }}>
                    <td>
                      <div className={styles.thumb}>
                        {imgUrl ? (
                          <Image src={imgUrl} alt="scan" fill style={{objectFit:'cover'}} />
                        ) : <span className={styles.thumbPlaceholder}>🌿</span>}
                      </div>
                    </td>
                    <td>
                      <div className={styles.diseaseName}>{formatName(d.disease_name)}</div>
                    </td>
                    <td>
                      <div className={styles.confCell}>
                        <div className={styles.confMini}>
                          <div className={styles.confMiniFill} style={{ width: `${Math.round(d.confidence * 100)}%` }} />
                        </div>
                        <span>{Math.round(d.confidence * 100)}%</span>
                      </div>
                    </td>
                    <td><span className={`badge badge-${d.severity || 'moderate'}`}>{d.severity || 'moderate'}</span></td>
                    <td><span className={styles.userId}>{d.user_email || d.user_id?.slice(0, 8) + '…'}</span></td>
                    <td><span className={styles.date}>{new Date(d.created_at).toLocaleDateString()}</span></td>
                    <td><span className={`badge ${d.is_healthy ? 'badge-active' : 'badge-moderate'}`}>{d.is_healthy ? 'Healthy' : 'Disease'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && total > PAGE_SIZE && (
          <div className={styles.pagination}>
            <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>← Prev</button>
            <span className={styles.pageInfo}>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
            <button className="btn btn-ghost" onClick={() => setPage(p => p+1)} disabled={page * PAGE_SIZE >= total}>Next →</button>
          </div>
        )}
      </main>
    </div>
  );
}
