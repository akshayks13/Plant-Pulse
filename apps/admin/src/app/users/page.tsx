'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getUsers, updateUser } from '@/lib/api';
import styles from './users.module.css';

type User = { id: string; email: string; full_name: string; role: string; is_active: boolean; created_at: string; total_diagnoses?: number };

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('xylem_admin_token')) { router.push('/login'); return; }
    (async () => {
      try {
        const data = await getUsers(1, 100) as { items: User[] } | User[];
        setUsers(Array.isArray(data) ? data : (data as { items: User[] }).items || []);
      } catch { setUsers([]); }
      finally { setLoading(false); }
    })();
  }, [router]);

  async function toggleUser(u: User) {
    setToggling(u.id);
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
    } catch { /* ignore */ }
    finally { setToggling(null); }
  }

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Users</h1>
            <p className={styles.sub}>{users.length} registered users</p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input className={`input ${styles.search}`} placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className={styles.countChip}>{filtered.length} users</div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Scans</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={styles.loadCell}><div className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyCell}>No users found.</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id} className={styles.row} style={{ animationDelay: `${i * 0.03}s` }}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>{u.full_name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className={styles.userName}>{u.full_name}</div>
                        <div className={styles.userEmail}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-admin' : u.role === 'EXPERT' ? 'badge-info' : 'badge-active'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td><span className={styles.date}>{new Date(u.created_at).toLocaleDateString()}</span></td>
                  <td><span className={styles.scanCount}>{u.total_diagnoses ?? '—'}</span></td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn ${u.is_active ? 'btn-danger' : 'btn-outline'} btn-sm`}
                      onClick={() => toggleUser(u)}
                      disabled={toggling === u.id}
                    >
                      {toggling === u.id ? '…' : u.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
