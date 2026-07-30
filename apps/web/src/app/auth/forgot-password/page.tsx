'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { forgotPassword } from '@/lib/api';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      sessionStorage.setItem('plant_pulse_reset_email', email.trim());
      router.push(`/auth/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <Link href="/auth/login" className={styles.back}>← Back to sign in</Link>
        <div className={styles.top}>
          <h1 className={styles.title}>Forgot password</h1>
          <p className={styles.sub}>Enter your email and we&apos;ll send a reset code.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <p className={styles.hint}>
            For demos, the OTP is printed in the backend server logs.
          </p>
          <div className={styles.group}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
        <p className={styles.footer}>
          Remembered it? <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
