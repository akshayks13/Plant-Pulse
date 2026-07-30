import styles from './page.module.css';
import { HeroInner, CtaBand } from '@/components/LandingSections';

const STEPS = [
  {
    num: '01',
    title: 'Upload a photo',
    desc: 'Take a clear picture of the affected leaf or plant and upload it securely.',
  },
  {
    num: '02',
    title: 'AI diagnosis',
    desc: 'Our model identifies the disease, severity, and confidence in seconds.',
  },
  {
    num: '03',
    title: 'Get treatment',
    desc: 'Receive chemical, organic, and preventive steps tailored to the result.',
  },
];

const FEATURES = [
  {
    title: 'AI Detection',
    desc: '38+ diseases identified from a single photo in under 3 seconds.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Treatment Plans',
    desc: 'Chemical, organic, and preventive guidance for every diagnosis.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 4h8v4a4 4 0 01-8 0V4z" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M12 12v8M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Confidence Score',
    desc: 'Every prediction ships with a clear confidence percentage.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M8 15l3-4 3 2 4-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Scan History',
    desc: 'Past diagnoses stored in one place so you can track plant health over time.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className={styles.root}>
      <div className={styles.glow} />

      <section className={styles.hero}>
        <div className={`container ${styles.heroLayout}`}>
          <div className={styles.heroInner}>
            <HeroInner />
          </div>

          <div className={styles.heroCard} aria-hidden>
            <div className={styles.cardHeader}>
              <div className={styles.cardDots}><span /><span /><span /></div>
              <span className={styles.cardTitle}>Scan result</span>
            </div>
            <div className={styles.cardImgZone}>
              <div className={styles.cardScanLine} />
              <svg className={styles.cardLeafSvg} width="64" height="64" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 6 8 6 16C6 20.4 9.6 24 14 24C18.4 24 22 20.4 22 16C22 8 14 2 14 2Z" fill="url(#leafg)"/>
                <path d="M14 8v14" stroke="rgba(6,13,10,0.35)" strokeWidth="1.2"/>
                <defs>
                  <linearGradient id="leafg" x1="6" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00e87a"/><stop offset="1" stopColor="#00b4d8"/>
                  </linearGradient>
                </defs>
              </svg>
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

      <section className={styles.howSection} id="how">
        <div className="container">
          <h2 className={styles.sectionTitle}>How it works</h2>
          <p className={styles.sectionSub}>Three steps from photo to treatment plan.</p>
          <div className={styles.steps}>
            {STEPS.map((s) => (
              <div key={s.num} className={styles.step}>
                <span className={styles.stepNum}>{s.num}</span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Built for growers</h2>
          <p className={styles.sectionSub}>Practical tools when something looks wrong on a leaf.</p>
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

      <section className={styles.ctaSection}>
        <div className="container">
          <CtaBand />
        </div>
      </section>
    </div>
  );
}
