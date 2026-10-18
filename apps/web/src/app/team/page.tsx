import type { Metadata } from 'next';
import Image from 'next/image';
import styles from './team.module.css';

export const metadata: Metadata = {
  title: 'Team — Plant-Pulse',
  description: 'The B.Tech CSE students and the faculty mentor behind Plant-Pulse, Amrita Vishwa Vidyapeetham, Coimbatore.',
};

type Member = {
  name: string;
  role: string;
  photo: string;
  roll?: string;
  email: string;
  github?: string;
  about: string;
};

const students: Member[] = [
  {
    name: 'Akshay KS',
    role: 'B.Tech CSE, 4th year',
    photo: '/team/akshay.jpg',
    roll: 'CB.SC.U4CSE23104',
    email: 'cb.sc.u4cse23104@cb.students.amrita.edu',
    github: 'https://github.com/akshayks13',
    about: 'DenseNet-121 model (architecture, leaf-grouped split, MixUp and label-smoothing recipe, evaluation) and the Plant-Pulse full-stack application: FastAPI back end, Next.js user and admin web apps, and deployment.',
  },
  {
    name: 'Amrith B',
    role: 'B.Tech CSE, 4th year',
    photo: '/team/amrith.jpg',
    roll: 'CB.SC.U4CSE23105',
    email: 'cb.sc.u4cse23105@cb.students.amrita.edu',
    github: 'https://github.com/AMRITH03',
    about: 'MobileNetV3-Large model (leaf-grouped split, official test-set evaluation, CutMix and label-smoothing recipe, Optuna search), the image augmentation pipeline, and the plant disease and remedy knowledge base.',
  },
  {
    name: 'Sarvesha Nandhakumar',
    role: 'B.Tech CSE, 4th year',
    photo: '/team/sarvesha.jpg',
    roll: 'CB.SC.U4CSE23145',
    email: 'cb.sc.u4cse23145@cb.students.amrita.edu',
    github: 'https://github.com/sarvesha302005',
    about: 'EfficientNet-B0 model (stratified split, training configuration, test-set evaluation) and the design and generation of the Multi-Plant Leaf Disease dataset, published on IEEE DataPort.',
  },
];

const mentor: Member = {
  name: 'Dr. Senthil Kumar T.',
  role: 'Professor, Department of Computer Science and Engineering',
  photo: '/team/mentor.jpg',
  email: 't_senthilkumar@cb.amrita.edu',
  about: 'Course instructor and mentor for the 23CSE473 Neural Networks and Deep Learning case study: guidance on problem selection and review of the dataset and the case study.',
};

function Card({ m }: { m: Member }) {
  return (
    <article className={styles.card}>
      <Image className={styles.photo} src={m.photo} alt={`Photo of ${m.name}`} width={360} height={480} />
      <div className={styles.body}>
        <h3 className={styles.name}>{m.name}</h3>
        <p className={styles.role}>{m.role}</p>
        {m.roll ? <p className={styles.roll}>{m.roll}</p> : null}
        <p className={styles.about}>{m.about}</p>
        <div className={styles.links}>
          <a href={`mailto:${m.email}`} className={styles.link}>{m.email}</a>
          {m.github ? (
            <a href={m.github} target="_blank" rel="noopener noreferrer" className={styles.link}>
              GitHub · {m.github.replace('https://github.com/', '')}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function TeamPage() {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Team 3</span>
          <h1 className={styles.title}>The people behind Plant-Pulse</h1>
          <p className={styles.lead}>
            Plant-Pulse is a case study for the course 23CSE473 Neural Networks and Deep Learning at
            Amrita Vishwa Vidyapeetham, Coimbatore, built by three fourth-year B.Tech CSE students
            under the guidance of our faculty mentor.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="students">
          <h2 id="students" className={styles.h2}>Students</h2>
          <div className={styles.grid}>
            {students.map(m => <Card key={m.name} m={m} />)}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="mentor">
          <h2 id="mentor" className={styles.h2}>Faculty mentor</h2>
          <div className={`${styles.grid} ${styles.single}`}>
            <Card m={mentor} />
          </div>
        </section>

        <p className={styles.affil}>
          Department of Computer Science and Engineering, School of Computing, Amrita Vishwa
          Vidyapeetham, Coimbatore, Tamil Nadu, India.
        </p>
      </div>
    </div>
  );
}
