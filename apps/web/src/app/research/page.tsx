import type { Metadata } from 'next';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Section, StatGrid, Stat, LinkCard, ButtonLink, DataTable, Callout,
} from '@/components/research/ui';
import { LINKS, TEAM } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Research — Plant-Pulse',
  description: 'The dataset, models, denoising, explainability, GAN, testing and ablation work behind Plant-Pulse.',
};

const STATUS = {
  header: ['Part', 'Status in the app today'],
  rows: [
    ['Three CNN classifiers (20 plant classes)', 'Live: choose one on the Scan page'],
    ['Treatment plan and knowledge base', 'Live: shown on every result'],
    ['DnCNN denoiser', 'Research result: not part of the scan flow yet'],
    ['Explainability (Grad-CAM)', 'Research result: heat maps are not shown on the result page yet'],
    ['Conditional GAN for lesion synthesis', 'Research model: trained, not connected to the app'],
    ['Test and evaluation, ablation study', 'Research reports: results on these pages'],
  ],
};

export default function ResearchHome() {
  return (
    <>
      <PageHero
        eyebrow="Research"
        title="The science behind Plant-Pulse"
        lead="Plant-Pulse is a university research project. This section shows what we built and, just as important, what we measured: our own dataset, three leaf-disease classifiers, a denoiser, explainability, a generative model, a formal test-and-evaluation study and an ablation study."
      >
        <div className={styles.heroActions}>
          <ButtonLink href="/research/models" primary>See model accuracy</ButtonLink>
          <ButtonLink href={LINKS.github} external>GitHub</ButtonLink>
        </div>
      </PageHero>

      <Section id="resources" title="Resources" lead="Everything is open: the code, the dataset archive and the dataset on Kaggle.">
        <div className={styles.cardGrid}>
          <LinkCard
            external href={LINKS.github} kicker="Source code" title="GitHub repository"
            desc="Web app, admin dashboard, backend API, treatment knowledge base and the trained models: akshayks13/Plant-Pulse."
            cta="View on GitHub"
          />
          <LinkCard
            external href={LINKS.dataport} kicker="Dataset archive" title="IEEE DataPort"
            desc="Leaf Disease Augmentation & Real-World Mobile Camera Denoising Dataset: the citable record of our dataset, with its description and methodology."
            cta="Open on IEEE DataPort"
          />
          <LinkCard
            external href={LINKS.kaggle} kicker="Dataset for machine learning" title="Kaggle: Multiplant Foliar Dataset"
            desc="The 8,000 paired clean and noisy leaf images (5 plants, 20 classes, about 746 MB), ready to use in notebooks."
            cta="Open on Kaggle"
          />
        </div>
      </Section>

      <Section id="glance" title="At a glance">
        <StatGrid>
          <Stat value="8,000" label="Leaf images" note="4,000 clean images, each with a noisy mobile-camera copy" />
          <Stat value="20" label="Plant classes" note="Betel, guava, hibiscus, mint and papaya: healthy plus three diseases each" />
          <Stat value="100%" label="Best test accuracy" note="EfficientNet-B0, 0 errors on 1,200 held-out images (synthetic data, see caveats)" />
          <Stat value="+8.45 dB" label="DnCNN denoising gain" note="Image quality (PSNR) 21.40 → 29.85 dB on 600 test pairs" />
          <Stat value="99.56%" label="PlantVillage accuracy" note="DenseNet-121 on the 10,709-image official test set: the data behind our test study" />
          <Stat value="72" label="Models in the ablation" note="Three backbones, up to eight training components removed one at a time, three seeds each" />
        </StatGrid>
      </Section>

      <Section id="topics" title="Explore the work">
        <div className={styles.cardGrid}>
          <LinkCard href="/research/models" kicker="Classifiers" title="Models & accuracy" desc="Accuracy, error counts, calibration and speed of the three models used in the Scan page, plus PlantVillage results for reference." cta="Open" />
          <LinkCard href="/research/dataset" kicker="Data" title="The Multi-Plant dataset" desc="How the 8,000 paired images were built: framing, synthetic lesions and a mobile-camera degradation model." cta="Open" />
          <LinkCard href="/research/denoising" kicker="Image restoration" title="Denoising with DnCNN" desc="A residual denoiser that lifts image quality by 8.45 dB, and what it does for classification." cta="Open" />
          <LinkCard href="/research/xai" kicker="Explainable AI" title="Explainability (Grad-CAM)" desc="Heat maps that show which part of the leaf drove a prediction, and how far they can be trusted." cta="Open" />
          <LinkCard href="/research/gan" kicker="Generative model" title="Conditional GAN" desc="An attention-guided GAN that paints disease symptoms onto healthy leaves: design, losses and status." cta="Open" />
          <LinkCard href="/research/testing" kicker="Test & evaluation" title="Testing the model properly" desc="A study using the US CDAO framework: calibration, corruptions, rotations, adversarial attacks and rare cases." cta="Open" />
          <LinkCard href="/research/ablation" kicker="Ablation study" title="What really matters in training" desc="72 models trained to find which training ingredients help each backbone, with confidence intervals." cta="Open" />
        </div>
      </Section>

      <Section id="status" title="What is live and what is research" lead="We keep the two clearly apart so that nothing here is oversold.">
        <DataTable table={STATUS} wrap />
        <Callout kind="caveat" title="Read the accuracy numbers with care">
          <p>The 99–100% figures come from our dataset, whose disease patterns were generated procedurally and are deliberately easy to tell apart. They show the models learn that task well, not that they will be right on every photo from a garden. In informal checks on photographs from other public sources, the models were right only about a third of the time. The Testing page explains how we measured this honestly.</p>
        </Callout>
      </Section>

      <Section id="team" title="Team">
        <div className={styles.team}>
          {TEAM.students.map(n => (
            <div key={n} className={styles.person}>
              <div className={styles.personName}>{n}</div>
              <div className={styles.personRole}>Student researcher</div>
            </div>
          ))}
          <div className={styles.person}>
            <div className={styles.personName}>{TEAM.mentor}</div>
            <div className={styles.personRole}>Faculty mentor</div>
          </div>
        </div>
        <p className={styles.fine}>{TEAM.school}. {TEAM.course}.</p>
      </Section>
    </>
  );
}
