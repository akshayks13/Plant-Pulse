'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './research.module.css';

const TABS = [
  { href: '/research', label: 'Overview' },
  { href: '/research/models', label: 'Models & accuracy' },
  { href: '/research/dataset', label: 'Dataset' },
  { href: '/research/denoising', label: 'Denoising (DnCNN)' },
  { href: '/research/xai', label: 'Explainability' },
  { href: '/research/gan', label: 'GAN' },
  { href: '/research/testing', label: 'Testing' },
  { href: '/research/ablation', label: 'Ablation' },
];

export default function ResearchNav() {
  const pathname = usePathname();
  return (
    <div className={styles.subnavBar}>
      <nav className={styles.subnav} aria-label="Research sections">
        {TABS.map(t => {
          const active = t.href === '/research' ? pathname === '/research' : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={`${styles.subLink} ${active ? styles.subActive : ''}`} aria-current={active ? 'page' : undefined}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
