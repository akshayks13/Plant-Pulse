'use client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { mockPredict } from '@/lib/mockDiagnosis';
import styles from './scan.module.css';

const CROPS = ['Auto-detect','Tomato','Potato','Pepper','Rose','Aloe Vera','Money Plant','Snake Plant','Strawberry','Apple'];

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropType, setCropType] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [error, setError] = useState('');

  function acceptFile(f: File) {
    setError('');
    if (!['image/jpeg','image/png','image/webp'].includes(f.type)) {
      setError('Only JPG, PNG, or WebP images.'); return;
    }
    if (f.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB.'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPhase('idle');
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan() {
    if (!file) return;
    setLoading(true); setPhase('scanning'); setError('');
    try {
      const result = await mockPredict(
        file,
        cropType && cropType !== 'Auto-detect' ? cropType.toLowerCase().replace(' ', '_') : undefined
      );
      setPhase('done');
      setTimeout(() => router.push(`/results/${result.id}`), 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed. Try again.');
      setPhase('idle'); setLoading(false);
    }
  }

  function clear() {
    setFile(null); setPreview(null); setPhase('idle'); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={`container ${styles.inner}`}>

        <div className={styles.header}>
          <h1 className={styles.title}>Scan a plant</h1>
          <p className={styles.sub}>Upload a clear photo of the affected leaf or plant for instant AI diagnosis.</p>
        </div>

        <div className={styles.layout}>

          {/* ── Upload zone ── */}
          <div className={styles.uploadCol}>
            <div
              className={`${styles.dropzone} ${dragging ? styles.over : ''} ${preview ? styles.hasFile : ''}`}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => !preview && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />

              {!preview ? (
                <div className={styles.emptyState}>
                  <div className={styles.uploadIconWrap}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <path d="M16 22V12M16 12L12 16M16 12L20 16" stroke="#00e87a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 26h12" stroke="#00e87a" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                    </svg>
                  </div>
                  <p className={styles.emptyMain}>{dragging ? 'Drop to upload' : 'Drop your image here'}</p>
                  <p className={styles.emptySub}>or click to browse · JPG, PNG, WebP · 10 MB max</p>
                </div>
              ) : (
                <div className={styles.preview}>
                  {phase === 'scanning' && (
                    <div className={styles.scanOverlay}>
                      <div className={styles.scanLine} />
                      <span className={styles.scanPill}>
                        <span className={styles.scanDot} />
                        Analysing…
                      </span>
                    </div>
                  )}
                  {phase === 'done' && (
                    <div className={styles.doneOverlay}>
                      <div className={styles.checkWrap}>
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                          <path d="M7 14l5 5 9-10" stroke="#00e87a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  )}
                  <Image src={preview} alt="Plant" fill style={{ objectFit: 'cover' }} />
                  {!loading && (
                    <button className={styles.clearBtn} onClick={e => { e.stopPropagation(); clear(); }}>✕</button>
                  )}
                </div>
              )}
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {file && <p className={styles.fileInfo}>{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
          </div>

          {/* ── Options & CTA ── */}
          <div className={styles.optionsCol}>
            <div className={styles.optionsCard}>
              <h3 className={styles.optionsTitle}>Plant type</h3>
              <p className={styles.optionsDesc}>Helps narrow down the diagnosis.</p>
              <div className={styles.cropList}>
                {CROPS.map(c => (
                  <button
                    key={c}
                    className={`${styles.cropBtn} ${cropType === c ? styles.cropActive : ''}`}
                    onClick={() => setCropType(c)}
                  >{c}</button>
                ))}
              </div>
            </div>

            <div className={styles.tipsCard}>
              <h3 className={styles.optionsTitle}>Tips for accuracy</h3>
              <ul className={styles.tipsList}>
                <li>Focus on the most affected leaf</li>
                <li>Use bright, even natural lighting</li>
                <li>Fill the frame with the plant</li>
                <li>Avoid blur, shadows, or reflections</li>
              </ul>
            </div>

            <button className={styles.scanBtn} onClick={handleScan} disabled={!file || loading}>
              {loading ? (
                <><span className={styles.spinner} />Scanning…</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3.5 7V5A1.5 1.5 0 015 3.5H7M11 3.5h2A1.5 1.5 0 0114.5 5v2M14.5 11v2A1.5 1.5 0 0113 14.5h-2M7 14.5H5A1.5 1.5 0 013.5 13v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  Analyse plant
                </>
              )}
            </button>

            <a href="/history" className={styles.histLink}>View scan history →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
