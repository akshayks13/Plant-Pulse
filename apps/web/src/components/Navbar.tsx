'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<{ full_name: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('xylem_user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch { setUser(null); }
  }, [pathname]);

  function logout() {
    localStorage.removeItem('xylem_token');
    localStorage.removeItem('xylem_user');
    window.location.href = '/';
  }

  return (
    <header className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 6 8 6 16C6 20.4 9.6 24 14 24C18.4 24 22 20.4 22 16C22 8 14 2 14 2Z" fill="url(#nl)"/>
            <defs>
              <linearGradient id="nl" x1="6" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00e87a"/><stop offset="1" stopColor="#00b4d8"/>
              </linearGradient>
            </defs>
          </svg>
          <span className={styles.logoText}>Xylem</span>
        </Link>

        {/* Nav links */}
        <nav className={styles.links}>
          <Link href="/scan" className={`${styles.link} ${pathname === '/scan' ? styles.active : ''}`}>
            Scan
          </Link>
          {user && (
            <Link href="/history" className={`${styles.link} ${pathname === '/history' ? styles.active : ''}`}>
              History
            </Link>
          )}
        </nav>

        {/* Actions */}
        <div className={styles.actions}>
          {user ? (
            <div className={styles.userRow}>
              <div className={styles.avatar}>{user.full_name.charAt(0).toUpperCase()}</div>
              <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
            </div>
          ) : (
            <>
              <Link href="/auth/login" className={styles.signIn}>Sign in</Link>
              <Link href="/auth/register" className={styles.getStarted}>Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
