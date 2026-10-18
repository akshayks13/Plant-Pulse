import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Toc, Section, H3, P, UL, LI, StatGrid, Stat, Callout, DataTable, Figure, Steps, ButtonLink, LinkCard,
} from '@/components/research/ui';
import { LINKS } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Dataset — Plant-Pulse',
  description: 'The Multi-Plant Foliar dataset: 8,000 paired clean and mobile-camera-noisy leaf images, 5 plants, 20 classes.',
};

const CLASSES = {
  header: ['Plant', 'Healthy class', 'Disease classes (pathogen)'],
  rows: [
    ['Betel (Piper betle)', 'Betel healthy', 'Bacterial spot (Xanthomonas), Anthracnose (Colletotrichum capsici), Powdery mildew (Oidium piperis)'],
    ['Guava (Psidium guajava)', 'Guava healthy', 'Red rust (Cephaleuros virescens), Anthracnose (C. gloeosporioides), Algal spot (Cephaleuros parasiticus)'],
    ['Hibiscus (H. rosa-sinensis)', 'Hibiscus healthy', 'Black spot (Pseudocercospora), Rust (Puccinia recondita), Yellow vein mosaic (vein-clearing virus)'],
    ['Mint (Mentha)', 'Mint healthy', 'Rust (Puccinia menthae), Leaf spot (Phoma strasseri), Powdery mildew (Erysiphe cichoracearum)'],
    ['Papaya (Carica papaya)', 'Papaya healthy', 'Ringspot (papaya ringspot virus), Black spot (Asperisporium caricae), Leaf blight (Corynespora cassiicola)'],
  ],
};

const NOISE = {
  header: ['Degradation', 'What it imitates', 'Setting'],
  rows: [
    ['Gaussian noise', 'Sensor grain from a high ISO, low-light shot', 'Zero mean, variance 0.005 to 0.025'],
    ['Poisson noise', 'Photon shot noise', 'Signal-dependent'],
    ['Salt-and-pepper noise', 'Dropped pixels, transmission errors', 'Density 0.01 to 0.03'],
    ['Defocus / motion blur', 'Hand shake', 'Gaussian kernels, 3×3 to 5×5'],
    ['JPEG compression', 'Phone and messaging-app compression', 'Added as a further degradation'],
  ],
};

export default function DatasetPage() {
  return (
    <>
      <PageHero
        eyebrow="Dataset"
        title="The Multi-Plant Foliar dataset"
        lead="Most public plant-disease photos are taken on plain backgrounds in even light. We built a dataset of five tropical and ornamental plants, with a mobile-camera-degraded copy of every image, so that models and denoisers can be trained and tested for field conditions."
      >
        <div className={styles.heroActions}>
          <ButtonLink href={LINKS.dataport} external primary>IEEE DataPort</ButtonLink>
          <ButtonLink href={LINKS.kaggle} external>Kaggle</ButtonLink>
          <ButtonLink href={LINKS.github} external>GitHub</ButtonLink>
        </div>
        <Toc items={[
          { id: 'glance', label: 'At a glance' },
          { id: 'classes', label: 'Plants & diseases' },
          { id: 'built', label: 'How it was built' },
          { id: 'samples', label: 'Sample images' },
          { id: 'uses', label: 'What it is for' },
          { id: 'limits', label: 'Limitations' },
          { id: 'access', label: 'Get the data' },
        ]} />
      </PageHero>

      <Section id="glance" title="At a glance">
        <StatGrid>
          <Stat value="4,000" label="Clean images" note="200 per class, 512 × 512 colour" />
          <Stat value="4,000" label="Noisy copies" note="A paired mobile-camera version of every clean image" />
          <Stat value="5 × 4" label="Plants × classes" note="Each plant: one healthy class and three diseases" />
          <Stat value="70/15/15" label="Train / validation / test" note="Fixed, non-overlapping split recorded for every image" />
        </StatGrid>
        <P>
          With PlantVillage (54,305 images, 38 classes) the project’s treatment knowledge base covers a combined label space of 58 classes. The three models used in the app are trained on the 20 Multi-Plant classes, at 224 × 224 pixels.
        </P>
      </Section>

      <Section id="classes" title="Plants and diseases">
        <DataTable table={CLASSES} caption="The 20 classes (200 images each)" wrap />
      </Section>

      <Section id="built" title="How it was built" lead="Every image goes through three stages, then a degraded twin is made.">
        <Steps items={[
          { title: '1. Frame the leaf', desc: 'The leaf is found with the Excess Green Index (ExG = 2G − R − B) and centred to fill about 78% of the frame. Empty edges are filled by reflection so leaves are never cut off or blurred at the border.' },
          { title: '2. Add the disease', desc: 'Lesions are generated and alpha-blended onto leaf tissue with biologically motivated, high-contrast patterns, so look-alike diseases stay separable.', accent: true },
          { title: '3. Make the noisy twin', desc: 'A mobile-camera degradation model produces a paired noisy copy of each clean image.' },
        ]} />
        <P>
          Example of why the patterns are deliberately distinct: anthracnose is drawn as concentric charcoal rings with shot-holes, while bacterial spot is drawn as lime-yellow halos bounded by the veins.
        </P>
        <H3>The degradation model</H3>
        <P>The noisy copy <em>y</em> is the clean image <em>x</em> plus a degradation: <em>y = x + n</em>. Four effects are combined, plus compression.</P>
        <DataTable table={NOISE} caption="Mobile-camera degradations applied to make the noisy twin" wrap />
      </Section>

      <Section id="samples" title="Sample images" lead="Each tile shows the true label and what the three models predicted, with their confidence.">
        <Figure
          src="/research/dataset-samples.jpg" width={1600} height={1111}
          alt="Six sample leaf images with the true label and the three models' predictions"
          caption={<>Samples 1 to 5 are dataset images (clean or handheld-noisy), and all three models name the right disease with 85 to 93% confidence. Sample 6 is a photograph from an online pathology archive, <strong>not</strong> from our dataset: the models are unsure (31 to 44%) and wrong. This is what to expect from images unlike the training data.</>}
        />
      </Section>

      <Section id="uses" title="What it is for">
        <UL>
          <LI><strong>Disease classification</strong> across five plants that PlantVillage does not cover.</LI>
          <LI><strong>Noise-robustness tests:</strong> train or test on clean, noisy or both.</LI>
          <LI><strong>Image denoising:</strong> paired clean and noisy images supply the training target (see <Link className={styles.inlineLink} href="/research/denoising">DnCNN denoising</Link>).</LI>
          <LI><strong>Domain adaptation</strong> from synthetic to real field images.</LI>
        </UL>
      </Section>

      <Section id="limits" title="Limitations">
        <Callout kind="caveat" title="Synthetic diseases, synthetic noise">
          <p>The lesions are generated procedurally. They represent early-to-mid-stage infections only, leave out late-stage defoliation and rot, show single focal leaves rather than dense canopies, and assume natural daylight (no flash or night scenes). The camera noise is simulated, not captured by real phones.</p>
          <p>Models trained on this dataset should therefore be validated on real field photographs before anyone relies on them in the field. Our own informal checks on outside photographs were disappointing, which is why we report this openly.</p>
        </Callout>
      </Section>

      <Section id="access" title="Get the data">
        <div className={styles.cardGrid}>
          <LinkCard external href={LINKS.dataport} kicker="Citable archive" title="IEEE DataPort" desc="The dataset record with its full description, methodology and metadata." cta="Open on IEEE DataPort" />
          <LinkCard external href={LINKS.kaggle} kicker="Ready to use" title="Kaggle" desc="All 8,000 images (about 746 MB) in notebook-ready form. The listing shows a GPL 2 licence." cta="Open on Kaggle" />
        </div>
      </Section>
    </>
  );
}
