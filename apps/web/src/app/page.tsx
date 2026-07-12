import Link from 'next/link';
import styles from './page.module.css';

const FEATURES = [
  { icon: '⬡', title: 'AI Detection', desc: '38+ diseases identified from a single photo in under 3 seconds.' },
  { icon: '⬡', title: 'Treatment Plans', desc: 'Chemical, organic, and preventive steps tailored to your diagnosis.' },
  { icon: '⬡', title: 'Confidence Score', desc: 'Every prediction ships with a precise confidence percentage.' },
  { icon: '⬡', title: 'Scan History', desc: 'All your past diagnoses stored and searchable in one place.' },
];

export default function HomePage() {
  return (
    <div className={styles.root}>
      {/* Subtle background glow */}
      <div className={styles.glow} />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroInner}>

            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              Plant AI · Powered by deep learning
            </div>

            <h1 className={styles.heroTitle}>
              Diagnose any<br />
              plant disease<br />
              <span className={styles.accent}>instantly.</span>
            </h1>

            <p className={styles.heroDesc}>
              Upload a photo — get a full diagnosis with symptoms,
              severity, and treatment in seconds.
            </p>

            <div className={styles.heroActions}>
              <Link href="/scan" className={styles.primaryBtn}>
                Scan a plant
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link href="/auth/register" className={styles.ghostBtn}>
                Create account
              </Link>
            </div>

            <div className={styles.heroMeta}>
              {[['38+', 'Diseases'], ['<3s', 'Per scan'], ['Free', 'Always']].map(([v, l]) => (
                <div key={l} className={styles.metaItem}>
                  <span className={styles.metaVal}>{v}</span>
                  <span className={styles.metaLabel}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Minimal result card preview */}
          <div className={styles.heroCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardDots}>
                <span /><span /><span />
              </div>
              <span className={styles.cardTitle}>Scan result</span>
            </div>
            <div className={styles.cardImgZone}>
              <div className={styles.cardScanLine} />
              <span className={styles.cardLeaf}>🌿</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardRow}>
                <span className={styles.cardLabel}>Disease</span>
                <span className={styles.cardVal}>Early Blight</span>
              </div>
              <div className={styles.cardRow}>
                <span className={styles.cardLabel}>Confidence</span>
                <span className={styles.cardAccent}>94.2%</span>
              </div>
              <div className={styles.cardBar}>
                <div className={styles.cardBarFill} style={{ width: '94%' }} />
              </div>
              <div className={styles.cardRow}>
                <span className={styles.cardLabel}>Severity</span>
                <span className={styles.cardBadge}>Moderate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className={styles.featuresSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Everything you need</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureItem}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ──────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaInner}>
            <div>
              <h2 className={styles.ctaTitle}>Ready to try it?</h2>
              <p className={styles.ctaDesc}>Free, instant, no account required for your first scan.</p>
            </div>
            <Link href="/scan" className={styles.primaryBtn}>
              Start scanning
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerInner}>
            <span className={styles.footerLogo}>Xylem</span>
            <div className={styles.footerLinks}>
              <Link href="/scan">Scan</Link>
              <Link href="/history">History</Link>
              <Link href="/auth/login">Sign in</Link>
            </div>
            <span className={styles.footerCopy}>© 2025 Xylem</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
