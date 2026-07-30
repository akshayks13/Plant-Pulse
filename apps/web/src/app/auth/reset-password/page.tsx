'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/lib/api';
import styles from '../login/login.module.css';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const emailFromQuery = params.get('email') || '';
  const [email] = useState(
    () => emailFromQuery || (typeof window !== 'undefined' ? sessionStorage.getItem('plant_pulse_reset_email') || '' : '')
  );
  const [otp] = useState(
    () => (typeof window !== 'undefined' ? sessionStorage.getItem('plant_pulse_reset_otp') || '' : '')
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !otp) {
      setError('Session expired. Please restart password reset.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, otp, password);
      sessionStorage.removeItem('plant_pulse_reset_email');
      sessionStorage.removeItem('plant_pulse_reset_otp');
      router.push('/auth/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <Link href="/auth/login" className={styles.back}>← Back to sign in</Link>
        <div className={styles.top}>
          <h1 className={styles.title}>New password</h1>
          <p className={styles.sub}>Choose a strong password for your account.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.group}>
            <label className={styles.label}>New password</label>
            <input className={styles.input} type="password" placeholder="Min. 6 characters"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <div className={styles.group}>
            <label className={styles.label}>Confirm password</label>
            <input className={styles.input} type="password" placeholder="Repeat password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className={styles.root}><div className={styles.card}>Loading…</div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
