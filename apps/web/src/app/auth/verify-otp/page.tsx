'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyOtp, forgotPassword } from '@/lib/api';
import styles from '../login/login.module.css';

function VerifyOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const emailFromQuery = params.get('email') || '';
  const [email] = useState(
    () => emailFromQuery || (typeof window !== 'undefined' ? sessionStorage.getItem('plant_pulse_reset_email') || '' : '')
  );
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (!email) {
        setError('Missing email. Start from forgot password.');
        setLoading(false);
        return;
      }
      await verifyOtp(email, otp.trim());
      sessionStorage.setItem('plant_pulse_reset_email', email);
      sessionStorage.setItem('plant_pulse_reset_otp', otp.trim());
      router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP.');
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setInfo('');
    try {
      await forgotPassword(email);
      setInfo('A new code was sent. Check the backend logs.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend.');
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <Link href="/auth/forgot-password" className={styles.back}>← Back</Link>
        <div className={styles.top}>
          <h1 className={styles.title}>Enter code</h1>
          <p className={styles.sub}>
            {email ? `Code sent for ${email}` : 'Enter the 6-digit reset code.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {info && <div className={styles.success}>{info}</div>}
          <p className={styles.hint}>Check the Plant-Pulse backend logs for the OTP.</p>
          <div className={styles.group}>
            <label className={styles.label}>OTP</label>
            <input
              className={styles.otpInput}
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoComplete="one-time-code"
            />
          </div>
          <button type="submit" className={styles.submit} disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying…' : 'Verify code'}
          </button>
        </form>
        <p className={styles.footer}>
          Didn&apos;t get it?{' '}
          <button type="button" className={styles.footerLink} onClick={resend} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Resend code
          </button>
        </p>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className={styles.root}><div className={styles.card}>Loading…</div></div>}>
      <VerifyOtpForm />
    </Suspense>
  );
}
