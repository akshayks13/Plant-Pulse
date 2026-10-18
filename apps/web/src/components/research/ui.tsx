import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './research.module.css';

/* Small presentational building blocks for the Research pages (all server components). */

export type TableData = { caption?: string; header: string[]; rows: string[][] };

export function PageHero({ eyebrow, title, lead, children }: {
  eyebrow: string; title: string; lead: ReactNode; children?: ReactNode;
}) {
  return (
    <header className={styles.hero}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
      {children}
    </header>
  );
}

export function Toc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className={styles.toc} aria-label="On this page">
      {items.map(i => <a key={i.id} href={`#${i.id}`} className={styles.tocLink}>{i.label}</a>)}
    </nav>
  );
}

export function Section({ id, title, lead, children, kicker, compact = false }: {
  id: string; title: string; lead?: ReactNode; children: ReactNode; kicker?: string; compact?: boolean;
}) {
  return (
    <section id={id} className={`${styles.section} ${compact ? styles.sectionCompact : ''}`}>
      {kicker ? <span className={styles.secondaryTag}>{kicker}</span> : null}
      <h2 className={compact ? styles.h2Small : styles.h2}>{title}</h2>
      {lead ? <p className={styles.sectionLead}>{lead}</p> : null}
      {children}
    </section>
  );
}

export const H3 = ({ children }: { children: ReactNode }) => <h3 className={styles.h3}>{children}</h3>;
export const P = ({ children }: { children: ReactNode }) => <p className={styles.p}>{children}</p>;
export const UL = ({ children }: { children: ReactNode }) => <ul className={styles.ul}>{children}</ul>;
export const LI = ({ children }: { children: ReactNode }) => <li className={styles.li}>{children}</li>;

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}
export function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {note ? <div className={styles.statNote}>{note}</div> : null}
    </div>
  );
}

export function Callout({ kind = 'note', title, children }: {
  kind?: 'note' | 'caveat' | 'good'; title?: string; children: ReactNode;
}) {
  const cls = kind === 'caveat' ? styles.calloutCaveat : kind === 'good' ? styles.calloutGood : styles.calloutNote;
  return (
    <aside className={`${styles.callout} ${cls}`}>
      {title ? <div className={styles.calloutTitle}>{title}</div> : null}
      <div className={styles.calloutBody}>{children}</div>
    </aside>
  );
}

export function LinkCard({ href, kicker, title, desc, cta = 'Open', external = false }: {
  href: string; kicker?: string; title: string; desc: string; cta?: string; external?: boolean;
}) {
  const inner = (
    <>
      {kicker ? <span className={styles.cardKicker}>{kicker}</span> : null}
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardDesc}>{desc}</span>
      <span className={styles.cardLink}>{cta} {external ? '↗' : '→'}</span>
    </>
  );
  return external
    ? <a className={styles.card} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
    : <Link className={styles.card} href={href}>{inner}</Link>;
}

/** Small linked tile: a headline number, a label and where to read more. */
export function MiniCard({ href, label, value, desc }: { href: string; label: string; value: string; desc: string }) {
  return (
    <Link className={styles.miniCard} href={href}>
      <span className={styles.miniLabel}>{label}</span>
      <span className={styles.miniValue}>{value}</span>
      <span className={styles.miniDesc}>{desc}</span>
      <span className={styles.miniLink}>Read more →</span>
    </Link>
  );
}

export function ButtonLink({ href, children, primary = false, external = false }: {
  href: string; children: ReactNode; primary?: boolean; external?: boolean;
}) {
  const cls = `${styles.btn} ${primary ? styles.btnPrimary : ''}`;
  return external
    ? <a className={cls} href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>
    : <Link className={cls} href={href}>{children}</Link>;
}

export function Figure({ src, alt, width, height, caption, narrow = false }: {
  src: string; alt: string; width: number; height: number; caption?: ReactNode; narrow?: boolean;
}) {
  return (
    <figure className={`${styles.figure} ${narrow ? styles.figureNarrow : styles.figureWide}`}>
      <div className={styles.figImg}>
        <Image src={src} alt={alt} width={width} height={height} unoptimized sizes="(max-width: 1080px) 100vw, 1080px" />
      </div>
      {caption ? <figcaption className={styles.figCaption}>{caption}</figcaption> : null}
    </figure>
  );
}

export function Steps({ items }: { items: { title: string; desc: string; accent?: boolean }[] }) {
  return (
    <div className={styles.flow}>
      {items.map((s, i) => (
        <div key={s.title} style={{ display: 'contents' }}>
          <div className={`${styles.flowStep} ${s.accent ? styles.flowStepAccent : ''}`}>
            <div className={styles.flowTitle}>{s.title}</div>
            <div className={styles.flowDesc}>{s.desc}</div>
          </div>
          {i < items.length - 1 ? <span className={styles.flowArrow} aria-hidden>→</span> : null}
        </div>
      ))}
    </div>
  );
}

export function Details({ summary, children, open = false }: { summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details className={styles.details} open={open}>
      <summary>{summary}</summary>
      <div className={styles.detailsBody}>{children}</div>
    </details>
  );
}

/* ─── Tables ──────────────────────────────────────────────────────────────── */

function TableShell({ caption, note, children }: { caption?: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.tableBlock}>
      {caption ? <div className={styles.tableCaption}>{caption}</div> : null}
      <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={caption || 'Data table'}>
        {children}
      </div>
      {note ? <div className={styles.tableNote}>{note}</div> : null}
    </div>
  );
}

/** Plain table. `strongRow` marks a row to emphasise (e.g. our model). */
export function DataTable({ table, caption, note, strongRow, wrap = false, compact = false }: {
  table: TableData; caption?: string; note?: ReactNode; strongRow?: (row: string[]) => boolean; wrap?: boolean; compact?: boolean;
}) {
  // Text-heavy tables read better left-aligned; numeric ones stay centred.
  const textHeavy = table.rows.some(r => r.slice(1).some(c => c.length > 30));
  return (
    <TableShell caption={caption ?? table.caption} note={note}>
      <table className={`${styles.table} ${wrap ? styles.wrapCells : ''} ${textHeavy ? styles.leftAlign : ''} ${compact ? styles.tableCompact : ''}`}>
        <thead><tr>{table.header.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className={strongRow?.(r) ? styles.rowStrong : undefined}>
              {r.map((c, j) => <td key={j}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

const num = (s: string) => parseFloat(s.replace('−', '-'));

/** Numeric cells shaded from red (low) to green (high). Columns outside [from, to] stay plain text. */
export function HeatTable({ table, caption, note, from = 1, to, min, max }: {
  table: TableData; caption?: string; note?: ReactNode; from?: number; to?: number; min: number; max: number;
}) {
  const last = to ?? table.header.length - 1;
  return (
    <TableShell caption={caption ?? table.caption} note={note}>
      <table className={styles.table}>
        <thead><tr>{table.header.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => {
                const v = num(c);
                if (j < from || j > last || Number.isNaN(v)) return <td key={j}>{c}</td>;
                const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
                const bg = `hsla(${Math.round(t * 125)}, 62%, 34%, 0.62)`;
                return <td key={j} className={styles.heatCell} style={{ background: bg }}>{c}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

const DELTA = /^([+−-]?\d+(?:\.\d+)?)\s*\[([+−-]?\d+(?:\.\d+)?),\s*([+−-]?\d+(?:\.\d+)?)\]$/;

/** Ablation table: each cell is "change [lo, hi]"; coloured only when the interval excludes zero. */
export function DeltaTable({ table, caption, note, lowerIsBetter = false }: {
  table: TableData; caption?: string; note?: ReactNode; lowerIsBetter?: boolean;
}) {
  return (
    <TableShell caption={caption ?? table.caption} note={note}>
      <table className={styles.table}>
        <thead><tr>{table.header.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className={i === 0 ? styles.rowStrong : undefined}>
              {r.map((c, j) => {
                if (j === 0 || i === 0) return <td key={j}>{c}</td>;
                const m = c.match(DELTA);
                if (!m) return <td key={j} className={styles.muted}>{c}</td>;
                const lo = num(m[2]); const hi = num(m[3]); const val = num(m[1]);
                const significant = lo > 0 || hi < 0;
                const good = lowerIsBetter ? val < 0 : val > 0;
                const cls = !significant ? styles.deltaNeutral : good ? styles.deltaGood : styles.deltaBad;
                return (
                  <td key={j} className={styles.deltaCell}>
                    <span className={cls}>{m[1]}</span>
                    <small>[{m[2]}, {m[3]}]</small>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.legend} style={{ padding: '10px 14px' }}>
        <span className={styles.legGood}>removing it clearly helps (interval excludes 0)</span>
        <span className={styles.legBad}>removing it clearly hurts (interval excludes 0)</span>
        <span className={styles.legNeutral}>not established</span>
      </div>
    </TableShell>
  );
}

/* ─── Bar chart (CSS only) ────────────────────────────────────────────────── */

export function BarChart({ title, sub, items, axisMin = 0, axisMax }: {
  title: string; sub?: string;
  items: { label: string; value: number; display: string }[];
  axisMin?: number; axisMax?: number;
}) {
  const max = axisMax ?? Math.max(...items.map(i => i.value));
  return (
    <div className={styles.chart}>
      <div className={styles.chartTitle}>{title}</div>
      <div className={styles.chartSub}>{sub}{axisMin > 0 ? `${sub ? ' · ' : ''}axis starts at ${axisMin}` : ''}</div>
      {items.map(i => {
        const pct = Math.max(2, Math.min(100, ((i.value - axisMin) / (max - axisMin)) * 100));
        return (
          <div key={i.label} className={styles.barRow}>
            <span className={styles.barLabel}>{i.label}</span>
            <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${pct}%`, display: 'block' }} /></span>
            <span className={styles.barValue}>{i.display}</span>
          </div>
        );
      })}
    </div>
  );
}
