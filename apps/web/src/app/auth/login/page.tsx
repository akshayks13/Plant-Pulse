'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, getMe } from '@/lib/api';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await login(email.trim(), password);
      localStorage.setItem('plant_pulse_token', access_token);
      const me = await getMe();
      localStorage.setItem('plant_pulse_user', JSON.stringify({
        id: me.id,
        full_name: me.full_name,
        email: me.email,
        role: me.role,
      }));
      router.push('/scan');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <Link href="/" className={styles.back}>← Back to home</Link>
        <div className={styles.top}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to your Plant-Pulse account.</p>
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
          <div className={styles.forgotRow}>
            <Link href="/auth/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
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
