'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, login, getMe } from '@/lib/api';
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
    setError('');
    setLoading(true);
    try {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      await register(email.trim(), password, name.trim());
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
      setError(err instanceof Error ? err.message : 'Registration failed.');
      setLoading(false);
    }
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
