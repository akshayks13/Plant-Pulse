'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.css';

const NAV = [
  { href: '/dashboard', icon: '▤', label: 'Dashboard' },
  { href: '/diagnoses', icon: '🔬', label: 'Diagnoses' },
  { href: '/users', icon: '👥', label: 'Users' },
  { href: '/system', icon: '⚙', label: 'System Logs' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('plant_pulse_admin_user') || 'null') : null;

  function logout() {
    localStorage.removeItem('plant_pulse_admin_token');
    localStorage.removeItem('plant_pulse_admin_user');
    router.push('/login');
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 6 8 6 16C6 20.4 9.6 24 14 24C18.4 24 22 20.4 22 16C22 8 14 2 14 2Z" fill="url(#sblg)"/>
            <defs>
              <linearGradient id="sblg" x1="6" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00e87a"/><stop offset="1" stopColor="#00b4d8"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <div className={styles.brandName}>Plant-Pulse</div>
          <div className={styles.brandTag}>Admin Panel</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`${styles.navItem} ${pathname === n.href || pathname.startsWith(n.href + '/') ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>{n.icon}</span>
            <span className={styles.navLabel}>{n.label}</span>
            {(pathname === n.href) && <div className={styles.activePill} />}
          </Link>
        ))}
      </nav>

      <div className={styles.bottom}>
        {user && (
          <div className={styles.userRow}>
            <div className={styles.avatar}>{user.full_name?.charAt(0)?.toUpperCase()}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.full_name}</span>
              <span className={styles.userRole}>Administrator</span>
            </div>
          </div>
        )}
        <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={logout}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
