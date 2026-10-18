'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/auth')) return null;

  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden>
              <path d="M14 2C14 2 6 8 6 16C6 20.4 9.6 24 14 24C18.4 24 22 20.4 22 16C22 8 14 2 14 2Z" fill="url(#fl)"/>
              <defs>
                <linearGradient id="fl" x1="6" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00e87a"/><stop offset="1" stopColor="#00b4d8"/>
                </linearGradient>
              </defs>
            </svg>
            <span>Plant-Pulse</span>
          </Link>
          <p className={styles.tagline}>AI plant disease detection for growers and gardeners.</p>
        </div>
        <nav className={styles.resources} aria-label="Project resources">
          <Link href="/research">Research</Link>
          <Link href="/team">Team</Link>
          <a href="https://github.com/akshayks13/Plant-Pulse" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://ieee-dataport.org/documents/leaf-disease-augmentation-real-world-mobile-camera-denoising-dataset" target="_blank" rel="noopener noreferrer">IEEE DataPort</a>
          <a href="https://www.kaggle.com/datasets/sarvesha223454/multiplant-foliar-dataset" target="_blank" rel="noopener noreferrer">Kaggle dataset</a>
        </nav>
        <div className={styles.meta}>
          <a href="mailto:support@plant-pulse.ai" className={styles.email}>support@plant-pulse.ai</a>
          <span className={styles.copy}>© {year} Plant-Pulse</span>
        </div>
      </div>
    </footer>
  );
}
