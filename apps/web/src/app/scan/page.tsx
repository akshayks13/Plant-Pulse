'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { predictDisease, retrieveTreatment, isAuthenticated, type Diagnosis } from '@/lib/api';
import { mockPredict, isMockMode } from '@/lib/mockDiagnosis';
import { prettyLabel, modelSourceLabel, RESULT_META, RETRIEVAL_STATUS_META } from '@/lib/pipeline';
import styles from './scan.module.css';

/**
 * Scan flow (each stage is a real round-trip, not a timer):
 *   1. upload   → POST /diagnosis/predict (run_retrieval=false)  → CNN label + confidence
 *   2. retrieve → POST /diagnosis/{id}/retrieve                  → treatment plan
 *   3. done     → /results/{id}
 */
type Stage = 'idle' | 'classifying' | 'retrieving' | 'done';

const STEPS: { key: Exclude<Stage, 'idle'> | 'upload'; title: string; sub: string }[] = [
  { key: 'upload',      title: 'Upload image',        sub: 'Sent securely to the API' },
  { key: 'classifying', title: 'CNN classification',  sub: 'Model names the disease + confidence' },
  { key: 'retrieving',  title: 'Treatment retrieval', sub: 'Knowledge base builds the plan' },
];

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [cnn, setCnn] = useState<Diagnosis | null>(null);       // after step 1
  const [final, setFinal] = useState<Diagnosis | null>(null);   // after step 2
  const [error, setError] = useState('');

  const loading = stage === 'classifying' || stage === 'retrieving';

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/auth/login');
    }
  }, [router]);

  function acceptFile(f: File) {
    setError('');
    if (!['image/jpeg','image/png','image/webp'].includes(f.type)) {
      setError('Only JPG, PNG, or WebP images.'); return;
    }
    if (f.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB.'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStage('idle'); setCnn(null); setFinal(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, []);

  async function handleScan() {
    if (!file) return;
    if (!isAuthenticated()) {
      router.push('/auth/login');
      return;
    }
    setError(''); setCnn(null); setFinal(null);

    // ── Offline demo mode (explicit opt-in only) ─────────────────────────
    if (isMockMode()) {
      setStage('classifying');
      const scan = await mockPredict(file);
      setCnn(scan); setFinal(scan); setStage('done');
      setTimeout(() => router.push(`/results/${scan.id}`), 700);
      return;
    }

    // ── Step 1: upload + CNN ────────────────────────────────────────────
    let step1: Diagnosis;
    try {
      setStage('classifying');
      step1 = await predictDisease(file, { runRetrieval: false });
      setCnn(step1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scan failed. Try again.');
      setStage('idle');
      return;
    }

    // ── Step 2: retrieval (treatment plan) ──────────────────────────────
    // A retrieval outage is reported inside the diagnosis (retrieval_status),
    // so we still go to the results page, which offers a retry.
    let step2: Diagnosis = step1;
    try {
      setStage('retrieving');
      step2 = await retrieveTreatment(step1.id);
    } catch {
      step2 = { ...step1, retrieval_status: 'unavailable', retrieval_note: 'Treatment service could not be reached.' };
    }
    setFinal(step2);
    setStage('done');
    setTimeout(() => router.push(`/results/${step2.id}`), 900);
  }

  function clear() {
    setFile(null); setPreview(null); setStage('idle'); setError(''); setCnn(null); setFinal(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function stepState(i: number): 'todo' | 'active' | 'done' | 'warn' {
    const order: Stage[] = ['idle', 'classifying', 'retrieving', 'done'];
    const cur = order.indexOf(stage);
    // step 0 (upload) and 1 (classify) share the first request
    if (i === 0) return cur >= 2 || stage === 'done' ? 'done' : cur === 1 ? 'active' : 'todo';
    if (i === 1) return cur >= 2 ? 'done' : cur === 1 ? 'active' : 'todo';
    if (stage === 'done') return final && final.retrieval_status === 'ok' ? 'done' : 'warn';
    return stage === 'retrieving' ? 'active' : 'todo';
  }

  return (
    <div className={styles.root}>
      <div className={styles.glow} />
      <div className={`container ${styles.inner}`}>

        <div className={styles.header}>
          <h1 className={styles.title}>Scan a plant</h1>
          <p className={styles.sub}>Upload a clear photo of one affected leaf — the CNN names the disease, then the knowledge base builds a treatment plan.</p>
        </div>

        <div className={styles.layout}>

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
                  {loading && (
                    <div className={styles.scanOverlay}>
                      <div className={styles.scanLine} />
                      <span className={styles.scanPill}>
                        <span className={styles.scanDot} />
                        {stage === 'classifying' ? 'Classifying with CNN…' : 'Retrieving treatment plan…'}
                      </span>
                    </div>
                  )}
                  {stage === 'done' && (
                    <div className={styles.doneOverlay}>
                      <div className={styles.checkWrap}>
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                          <path d="M7 14l5 5 9-10" stroke="#00e87a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  )}
                  <Image src={preview} alt="Plant" fill style={{ objectFit: 'cover' }} unoptimized />
                  {!loading && stage !== 'done' && (
                    <button className={styles.clearBtn} onClick={e => { e.stopPropagation(); clear(); }}>✕</button>
                  )}
                </div>
              )}
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {file && <p className={styles.fileInfo}>{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
          </div>

          <div className={styles.optionsCol}>

            {/* ── Pipeline card ─────────────────────────────────────── */}
            <div className={styles.pipelineCard}>
              <h3 className={styles.optionsTitle}>How your scan is processed</h3>
              <ol className={styles.steps}>
                {STEPS.map((s, i) => {
                  const st = stepState(i);
                  return (
                    <li key={s.key} className={`${styles.step} ${styles[`step_${st}`]}`}>
                      <span className={styles.stepIcon}>
                        {st === 'done' ? '✓' : st === 'warn' ? '!' : st === 'active' ? <span className={styles.stepSpinner} /> : i + 1}
                      </span>
                      <div className={styles.stepBody}>
                        <span className={styles.stepTitle}>{s.title}</span>
                        <span className={styles.stepSub}>
                          {i === 1 && cnn
                            ? <>{prettyLabel(cnn.disease_name)} · <b>{Math.round(cnn.confidence * 100)}%</b> <em>({modelSourceLabel(cnn.model_source)})</em></>
                            : i === 2 && final
                              ? <span style={{ color: (final.result_type && final.retrieval_status === 'ok') ? RESULT_META[final.result_type].color : RETRIEVAL_STATUS_META[final.retrieval_status].color }}>
                                  {final.retrieval_status === 'ok' && final.result_type
                                    ? RESULT_META[final.result_type].label
                                    : RETRIEVAL_STATUS_META[final.retrieval_status].label}
                                </span>
                              : s.sub}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className={styles.tipsCard}>
              <h3 className={styles.optionsTitle}>Tips for accuracy</h3>
              <ul className={styles.tipsList}>
                <li>One leaf, filling the frame</li>
                <li>Bright, even natural lighting</li>
                <li>Plain background if possible</li>
                <li>Avoid blur, shadows, or reflections</li>
              </ul>
            </div>

            <button className={styles.scanBtn} onClick={handleScan} disabled={!file || loading || stage === 'done'}>
              {loading ? (
                <><span className={styles.spinner} />{stage === 'classifying' ? 'Classifying…' : 'Retrieving…'}</>
              ) : stage === 'done' ? (
                <>Opening results…</>
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
