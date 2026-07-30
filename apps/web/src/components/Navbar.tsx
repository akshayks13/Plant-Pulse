'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

type User = { full_name: string; email?: string };

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = href.startsWith('/') && !href.includes('#')
    ? pathname === href || pathname.startsWith(`${href}/`)
    : false;
  return (
    <Link href={href} className={`${styles.link} ${active ? styles.active : ''}`}>
      {label}
    </Link>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('plant_pulse_user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    }
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  function logout() {
    localStorage.removeItem('plant_pulse_token');
    localStorage.removeItem('plant_pulse_user');
    window.location.href = '/';
  }

  const howHref = pathname === '/' ? '#how' : '/#how';

  const appLinks = user ? (
    <>
      <NavLink href="/history" label="History" pathname={pathname} />
      <NavLink href="/community" label="Community" pathname={pathname} />
    </>
  ) : null;

  return (
    <>
      <header className={`${styles.nav} ${scrolled || drawerOpen ? styles.scrolled : ''}`}>
        <div className={styles.inner}>
          <Link href="/" className={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden>
              <path d="M14 2C14 2 6 8 6 16C6 20.4 9.6 24 14 24C18.4 24 22 20.4 22 16C22 8 14 2 14 2Z" fill="url(#nl)"/>
              <defs>
                <linearGradient id="nl" x1="6" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00e87a"/><stop offset="1" stopColor="#00b4d8"/>
                </linearGradient>
              </defs>
            </svg>
            <span className={styles.logoText}>Plant-Pulse</span>
          </Link>

          <nav className={styles.links} aria-label="Primary">
            <Link href={howHref} className={styles.link}>How it works</Link>
            <NavLink href="/scan" label="Scan" pathname={pathname} />
            {appLinks}
          </nav>

          <div className={styles.actions}>
            {user ? (
              <div className={styles.userRow}>
                <Link href="/profile" className={styles.avatarLink} title="Profile">
                  <span className={styles.avatar}>{user.full_name.charAt(0).toUpperCase()}</span>
                </Link>
                <button type="button" className={styles.signOut} onClick={logout}>
                  Sign out
                </button>
              </div>
            ) : (
              <div className={styles.guestActions}>
                <Link href="/auth/login" className={styles.signIn}>Sign in</Link>
                <Link href="/auth/register" className={styles.getStarted}>Get started</Link>
              </div>
            )}

            <button
              type="button"
              className={styles.burger}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(v => !v)}
            >
              <span className={`${styles.burgerLine} ${drawerOpen ? styles.burgerX1 : ''}`} />
              <span className={`${styles.burgerLine} ${drawerOpen ? styles.burgerX2 : ''}`} />
              <span className={`${styles.burgerLine} ${drawerOpen ? styles.burgerX3 : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className={styles.drawer} role="dialog" aria-modal="true">
          <nav className={styles.drawerNav}>
            <Link href={howHref} className={styles.drawerLink}>How it works</Link>
            <Link href="/scan" className={styles.drawerLink}>Scan</Link>
            {user && (
              <>
                <Link href="/history" className={styles.drawerLink}>History</Link>
                <Link href="/community" className={styles.drawerLink}>Community</Link>
                <Link href="/profile" className={styles.drawerLink}>Profile</Link>
              </>
            )}
            <div className={styles.drawerDivider} />
            {user ? (
              <button type="button" className={styles.drawerLogout} onClick={logout}>Sign out</button>
            ) : (
              <>
                <Link href="/auth/login" className={styles.drawerLink}>Sign in</Link>
                <Link href="/auth/register" className={styles.drawerCta}>Get started</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
