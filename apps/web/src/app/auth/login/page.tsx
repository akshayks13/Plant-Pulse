'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';

// Simple local auth — stores credentials in localStorage
function saveUser(name: string, email: string) {
  const user = { full_name: name, email };
  localStorage.setItem('xylem_token', 'local-' + btoa(email));
  localStorage.setItem('xylem_user', JSON.stringify(user));
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    await new Promise(r => setTimeout(r, 600));

    // Check against locally registered accounts
    const accounts = JSON.parse(localStorage.getItem('xylem_accounts') || '{}');
    const account = accounts[email.toLowerCase()];

    if (!account || account.password !== password) {
      setError('Invalid email or password.');
      setLoading(false); return;
    }
    saveUser(account.name, email);
    router.push('/scan');
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <Link href="/" className={styles.back}>← Back to home</Link>
        <div className={styles.top}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to your Xylem account.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.group}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className={styles.group}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className={styles.footer}>
          No account? <Link href="/auth/register" className={styles.footerLink}>Create one free</Link>
        </p>
      </div>
    </div>
  );
}
