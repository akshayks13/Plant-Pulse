'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/login.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    await new Promise(r => setTimeout(r, 600));

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false); return;
    }

    // Store account locally
    const accounts = JSON.parse(localStorage.getItem('xylem_accounts') || '{}');
    const key = email.toLowerCase();
    if (accounts[key]) {
      setError('Email already registered. Sign in instead.');
      setLoading(false); return;
    }
    accounts[key] = { name: name.trim(), password };
    localStorage.setItem('xylem_accounts', JSON.stringify(accounts));

    // Auto-login
    const user = { full_name: name.trim(), email: key };
    localStorage.setItem('xylem_token', 'local-' + btoa(key));
    localStorage.setItem('xylem_user', JSON.stringify(user));
    router.push('/scan');
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <Link href="/" className={styles.back}>← Back to home</Link>
        <div className={styles.top}>
          <h1 className={styles.title}>Create account</h1>
          <p className={styles.sub}>Free forever. No credit card needed.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.group}>
            <label className={styles.label}>Full name</label>
            <input className={styles.input} type="text" placeholder="Your name"
              value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
          </div>
          <div className={styles.group}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className={styles.group}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" placeholder="Min. 6 characters"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className={styles.footer}>
          Already have an account? <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
