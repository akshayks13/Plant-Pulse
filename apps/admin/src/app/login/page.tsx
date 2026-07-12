'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin, getMe } from '@/lib/api';
import styles from './login.module.css';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const tokens = await adminLogin(email, password) as { access_token: string };
      localStorage.setItem('xylem_admin_token', tokens.access_token);
      const me = await getMe() as { role: string; full_name: string };
      if (me.role !== 'ADMIN') { localStorage.removeItem('xylem_admin_token'); throw new Error('Access denied. Admin role required.'); }
      localStorage.setItem('xylem_admin_user', JSON.stringify(me));
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />
      <div className={styles.bgGrid} />

      <div className={styles.card}>
        <div className={styles.topBrand}>
          <div className={styles.logoWrap}>
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
              <path d="M14 2C14 2 6 8 6 16C6 20.4 9.6 24 14 24C18.4 24 22 20.4 22 16C22 8 14 2 14 2Z" fill="url(#adlg)"/>
              <defs>
                <linearGradient id="adlg" x1="6" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00e87a"/><stop offset="1" stopColor="#00b4d8"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className={styles.brand}>Xylem Admin</span>
        </div>

        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.sub}>Admin access only — credentials required.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>⚠ {error}</div>}

          <div className={styles.group}>
            <label className={styles.label}>Email address</label>
            <input className="input" type="email" placeholder="admin@xylem.ai" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>Password</label>
            <div className={styles.passWrap}>
              <input className="input" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={loading}>
            {loading ? <><span className="spinner" style={{width:16,height:16}} /> Authenticating…</> : 'Sign in to Dashboard'}
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerDot} />
          Protected admin area
        </div>
      </div>
    </div>
  );
}
