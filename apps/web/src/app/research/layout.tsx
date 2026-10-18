import ResearchNav from '@/components/research/ResearchNav';
import styles from '@/components/research/research.module.css';

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ResearchNav />
      <div className={styles.page}>
        <div className={styles.wrap}>{children}</div>
      </div>
    </>
  );
}
