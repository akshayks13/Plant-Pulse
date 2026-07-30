'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/api';
import styles from '../app/page.module.css';

export function HeroInner() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
  }, []);

  return (
    <>
      <p className={styles.brandMark}>Plant-Pulse</p>
      <h1 className={styles.heroTitle}>
        Diagnose plant disease<br />
        <span className={styles.accent}>with confidence.</span>
      </h1>
      <p className={styles.heroDesc}>
        {loggedIn
          ? 'Upload a photo and get symptoms, severity, and treatment recommendations in seconds.'
          : 'Sign in, upload a photo, and get symptoms, severity, and treatment recommendations in seconds.'}
      </p>
      <div className={styles.heroActions}>
        <Link href="/scan" className={styles.primaryBtn}>
          Scan a plant
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        {loggedIn ? (
          <Link href="/history" className={styles.ghostBtn}>
            View history
          </Link>
        ) : (
          <Link href="/auth/register" className={styles.ghostBtn}>
            Create account
          </Link>
        )}
      </div>
    </>
  );
}

export function CtaBand() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
  }, []);

  return (
    <div className={styles.ctaInner}>
      <div>
        <h2 className={styles.ctaTitle}>{loggedIn ? 'Ready to scan?' : 'Ready to get started?'}</h2>
        <p className={styles.ctaDesc}>
          {loggedIn
            ? 'Jump back in and diagnose your next plant.'
            : 'Create a free account to diagnose plants and save your history.'}
        </p>
      </div>
      <Link href={loggedIn ? '/scan' : '/auth/register'} className={styles.primaryBtn}>
        {loggedIn ? 'Scan a plant' : 'Get started'}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>
    </div>
  );
}
