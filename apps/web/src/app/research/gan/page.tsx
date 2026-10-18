import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Toc, Section, H3, P, UL, LI, Callout, DataTable, Steps,
} from '@/components/research/ui';

export const metadata: Metadata = {
  title: 'Conditional GAN — Plant-Pulse',
  description: 'An attention-guided conditional GAN that synthesises disease symptoms on healthy leaves.',
};

const ARCH = {
  header: ['Component', 'Specification', 'Role'],
  rows: [
    ['Condition embedding', '32 dimensions (generator), 16 (discriminator)', 'Turns the 20 plant-and-disease classes into dense vectors the networks can use'],
    ['Generator', 'Attention U-Net with FiLM bottleneck: 4 encoder levels (64, 128, 256, 512 channels), FiLM residual blocks, 4 decoder levels with spatial attention gates', 'Decides where and how the disease should appear on the leaf'],
    ['Output head', 'Two outputs: an RGB texture change (tanh, range −1 to 1) multiplied by a lesion mask (sigmoid, range 0 to 1)', 'Paints lesions only where the mask says so, leaving the rest of the leaf untouched'],
    ['Discriminator', 'PatchGAN with a 70 × 70 receptive field and spectral normalisation', 'Judges small patches as real or fake, which pushes for realistic local texture'],
  ],
};

const LOSSES = {
  header: ['Loss term', 'Weight', 'What it asks for'],
  rows: [
    ['Adversarial (BCE vs PatchGAN)', '1.0', 'Fool the discriminator'],
    ['Content (L1)', '100.0', 'Keep the leaf’s own veins and shape unchanged'],
    ['Sobel edge', '25.0', 'Sharp lesion boundaries: necrosis edges, concentric rings, pustules'],
    ['Diagnostic guidance (cross-entropy)', '5.0', 'A frozen EfficientNet-B0 classifier must recognise the intended disease in the result'],
  ],
};

const TRAIN = {
  header: ['Setting', 'Value'],
  rows: [
    ['Optimiser (generator and discriminator)', 'AdamW, learning rate 2e−4, β1 = 0.5, β2 = 0.999, weight decay 1e−4'],
    ['Batch size', '16 (images cached in memory to fit a 4 GB GPU)'],
    ['Conditions', '20 classes: 5 plants, healthy plus three diseases each'],
    ['Hardware', 'NVIDIA GeForce RTX 3050 Laptop GPU (4 GB)'],
  ],
};

export default function GanPage() {
  return (
    <>
      <PageHero
        eyebrow="Generative model"
        title="A conditional GAN for leaf symptoms"
        lead="A GAN (generative adversarial network) is a pair of networks: one invents images, the other tries to spot the fakes, and each pushes the other to improve. Ours is conditional: you tell it which plant and which disease, and it paints those symptoms onto a healthy leaf."
      >
        <Toc items={[
          { id: 'how', label: 'How it works' },
          { id: 'design', label: 'Design' },
          { id: 'losses', label: 'What it is trained to do' },
          { id: 'use', label: 'What it is for' },
          { id: 'status', label: 'Status & limits' },
        ]} />
      </PageHero>

      <Section id="how" title="How it works">
        <Steps items={[
          { title: 'Healthy leaf + condition', desc: 'A healthy leaf photo plus the chosen plant and disease ID.' },
          { title: 'Attention U-Net generator', desc: 'Predicts a texture change and a lesion mask.', accent: true },
          { title: 'Synthetic diseased leaf', desc: 'Texture applied only inside the mask, so the leaf stays itself.' },
          { title: 'Two critics', desc: 'A PatchGAN judge for realism and a frozen EfficientNet-B0 for “does it look like that disease?”' },
        ]} />
        <P>
          The two-output design is the key idea. Instead of redrawing the whole leaf, the generator produces a <strong>change</strong> and a <strong>mask</strong>, and the result is the original leaf with that change applied only where the mask is on, so the leaf’s own veins and colours stay intact outside the lesions.
        </P>
      </Section>

      <Section id="design" title="Design">
        <DataTable table={ARCH} caption="Architecture of the attention-guided conditional GAN" wrap />
      </Section>

      <Section id="losses" title="What it is trained to do" lead="Four loss terms are added together. The large content weight keeps the leaf recognisable; the classifier term keeps the disease recognisable.">
        <DataTable table={LOSSES} caption="Loss terms and their weights" wrap />
        <DataTable table={TRAIN} caption="Training configuration" wrap />
      </Section>

      <Section id="use" title="What it is for">
        <UL>
          <LI><strong>Synthetic augmentation:</strong> adding extra diseased examples for rare or hard-to-photograph conditions.</LI>
          <LI><strong>Visualisation:</strong> showing what a disease would look like on a particular healthy leaf.</LI>
        </UL>
        <P>
          Our dataset’s own lesions were drawn procedurally by hand-designed rules (see the <Link href="/research/dataset" className={styles.inlineLink}>Dataset</Link> page). The GAN is a separate, <em>learned</em> way to attack the same problem.
        </P>
      </Section>

      <Section id="status" title="Status and limits">
        <Callout kind="caveat" title="Trained, not yet evaluated or deployed">
          <p>The model has been trained on the 20 classes and the checkpoint is part of the project. We have <strong>not</strong> yet measured how realistic its output is with a numerical score (such as FID), run an expert or user review of the images, or tested whether adding its images helps a classifier. It is not connected to the app.</p>
        </Callout>
        <H3>Next steps</H3>
        <UL>
          <LI>Measure realism (FID or similar) and have plant-health experts review samples.</LI>
          <LI>Test whether GAN-made images improve a classifier on real field photos.</LI>
          <LI>Check that generated lesions are species-accurate and not just visually striking.</LI>
        </UL>
      </Section>
    </>
  );
}
