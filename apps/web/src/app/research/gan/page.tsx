import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Toc, Section, H3, P, UL, LI, StatGrid, Stat, Callout, DataTable, Steps, Figure,
} from '@/components/research/ui';

export const metadata: Metadata = {
  title: 'Conditional GAN — Plant-Pulse',
  description: 'A conditional GAN that was built to paint disease symptoms onto healthy leaves: its design, what the trained model produces, and what we learnt.',
};

const ARCH = {
  header: ['Component', 'Specification', 'Role'],
  rows: [
    ['Condition embedding', '32 dimensions (generator), 16 (discriminator)', 'Turns the 20 plant-and-disease classes into dense vectors the networks can use'],
    ['Generator', 'U-Net: a 64-channel input layer, 3 down-sampling stages (128, 256, 512 channels), 4 FiLM residual blocks at the bottleneck, 3 up-sampling stages with skip connections. 25.31 million parameters', 'Decides where and how the disease should appear on the leaf'],
    ['Output heads', 'Two outputs: an RGB texture change (tanh, range −1 to 1) and a lesion mask (sigmoid, range 0 to 1). The mask is the “attention”', 'Paints lesions only where the mask is on, so the rest of the leaf should stay untouched'],
    ['Discriminator', 'PatchGAN with a 70 × 70 receptive field and instance normalisation. 2.79 million parameters', 'Judges small patches as real or fake, which pushes for realistic local texture'],
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
    ['Batch size and precision', '16, mixed precision (images cached in memory to fit a 4 GB GPU)'],
    ['Conditions', '20 classes: 5 plants, healthy plus three diseases each'],
    ['Images per class', 'At most 35 to 40'],
    ['Epochs', '8 in the training command; the saved checkpoint records epoch 6'],
    ['Hardware', 'NVIDIA GeForce RTX 3050 Laptop GPU (4 GB)'],
  ],
};

const NEURAL = {
  header: ['Requested disease', 'Classifier prediction', 'Confidence', 'Matches request'],
  rows: [
    ['Guava red rust', 'Hibiscus_Healthy', '18.6%', 'No'],
    ['Guava anthracnose', 'Hibiscus_Healthy', '19.1%', 'No'],
    ['Guava algal spot', 'Papaya_Healthy', '11.7%', 'No'],
  ],
};

const RENDERED = {
  header: ['Plant', 'Rendered disease', 'Classifier prediction', 'Confidence'],
  rows: [
    ['Guava', 'Red rust', 'Guava_Red_Rust', '87.7%'],
    ['Guava', 'Anthracnose', 'Guava_Anthracnose', '74.2%'],
    ['Guava', 'Algal spot', 'Guava_Algal_Spot', '86.4%'],
    ['Papaya', 'Ringspot', 'Papaya_Ringspot', '85.7%'],
    ['Papaya', 'Black spot', 'Papaya_Black_Spot', '88.5%'],
    ['Papaya', 'Leaf blight', 'Papaya_Leaf_Blight', '77.8%'],
  ],
};

export default function GanPage() {
  return (
    <>
      <PageHero
        eyebrow="Generative model"
        title="A conditional GAN for leaf symptoms"
        lead="A GAN (generative adversarial network) is a pair of networks: one invents images, the other tries to spot the fakes, and each pushes the other to improve. Ours is conditional: you tell it which plant and which disease, and it is meant to paint those symptoms onto a healthy leaf. It is trained, but its output is not yet good enough to use, and this page shows both the design and what we learnt."
      >
        <Toc items={[
          { id: 'how', label: 'How it works' },
          { id: 'design', label: 'Design' },
          { id: 'losses', label: 'What it is trained to do' },
          { id: 'found', label: 'What we found' },
          { id: 'status', label: 'Status & limits' },
        ]} />
      </PageHero>

      <Section id="how" title="How it works">
        <Steps items={[
          { title: 'Healthy leaf + condition', desc: 'A healthy leaf photo plus the chosen plant and disease ID.' },
          { title: 'U-Net generator', desc: 'Predicts a texture change and a lesion mask.', accent: true },
          { title: 'Synthetic diseased leaf', desc: 'Texture applied only inside the mask, so the leaf should stay itself.' },
          { title: 'Two critics', desc: 'A PatchGAN judge for realism and a frozen EfficientNet-B0 for “does it look like that disease?”' },
        ]} />
        <P>
          The two-output design is the key idea. Instead of redrawing the whole leaf, the generator produces a <strong>change</strong> and a <strong>mask</strong>, and the result is the original leaf with that change applied only where the mask is on: <em>(1 − mask) × leaf + mask × change</em>. The mask is a smooth map that never reaches exactly zero, so preservation of the leaf is approximate, and it depends on the mask being learned well.
        </P>
        <Figure src="/research/gan-architecture.png" width={1985} height={971} alt="Diagram of the generator, the compositor, the discriminator and the classifier"
          caption="The generator and the signals it is trained with." />
      </Section>

      <Section id="design" title="Design" lead="The architecture below was checked against the saved model file: the layer shapes and the parameter counts (25,308,228 and 2,785,409, 28.09 million in all) match.">
        <DataTable table={ARCH} caption="Architecture of the conditional GAN" wrap />
      </Section>

      <Section id="losses" title="What it is trained to do" lead="Four loss terms are added together. The large content weight keeps the leaf recognisable; the classifier term keeps the disease recognisable.">
        <DataTable table={LOSSES} caption="Loss terms and their weights" wrap />
        <DataTable table={TRAIN} caption="Training configuration" wrap />
      </Section>

      <Section id="found" title="What we found" lead="We looked at what the trained model actually produces and let our leaf classifier read each result. These are the only generated images we have, so they are all shown.">
        <StatGrid>
          <Stat value="0 of 3" label="Neural outputs recognised" note="On a real guava photo the classifier read the three requested diseases as healthy leaves, with 12 to 19% confidence" />
          <Stat value="6 of 6" label="Rule-based renders recognised" note="Confidence 74 to 89%, mean 83%, on a guava and a papaya image" />
          <Stat value="28.09 M" label="Parameters in the saved model" note="Trained to epoch 6 of a planned 8" />
        </StatGrid>

        <H3>The trained neural network</H3>
        <P>
          On a real guava photograph, the network turned the whole image bright green with a regular grid of dark dots. The veins and background were not preserved, and the three requested diseases gave almost identical pictures.
        </P>
        <Figure src="/research/gan-neural-output.jpg" width={1520} height={478} alt="A real guava leaf photo and three outputs of the neural generator, all green with a grid pattern"
          caption="Output of the trained neural generator for a real guava photo. Above each panel: the disease we asked for, and what the classifier read." />
        <DataTable table={NEURAL} caption="Classifier read-out on the neural generator’s outputs" wrap />

        <H3>The rule-based renderer</H3>
        <P>
          The generation script also has a renderer that draws lesions with hand-designed rules, like the one that built our dataset, instead of calling the network. Its lesions are crisp, stay on the leaf and leave the veins and background alone. We show them because they are the realistic examples the project has, but they come from the renderer, <strong>not</strong> from the neural network.
        </P>
        <Figure src="/research/gan-render-guava.jpg" width={1520} height={478} alt="A guava leaf photo with rendered red rust, anthracnose and algal spot"
          caption="Rule-based renderer on a guava photo, with the classifier read-out above each panel." />
        <Figure src="/research/gan-render-papaya.jpg" width={1520} height={478} alt="A papaya leaf image with rendered ringspot, black spot and leaf blight"
          caption="Rule-based renderer on a papaya leaf image." />
        <DataTable table={RENDERED} caption="Classifier read-out on the rendered images" wrap />
        <P>
          The classifier was trained on our dataset, whose diseased images come from the same kind of renderer, so these results show that the renders match the dataset’s style. They do not show that a plant pathologist would find them realistic, and there are only six samples.
        </P>
      </Section>

      <Section id="status" title="Status and limits">
        <Callout kind="caveat" title="Trained, but not yet usable">
          <p>The saved network does not yet produce usable diseased leaves. Plausible reasons, none tested yet: the input was a real field photo while training used dataset images; training was short (epoch 6, at most 35 to 40 images per class); the 4 × 4 transposed convolutions are known to cause grid-like artefacts; and nothing in the loss keeps the mask small, so it may cover the whole image.</p>
          <p>We have <strong>not</strong> measured realism with a score such as FID, kept training curves, run an expert review, or tested whether generated images help a classifier. The model is not connected to the app.</p>
        </Callout>
        <Callout kind="note" title="A correction">
          <p>An earlier description of this model mentioned spatial attention gates, four encoder levels and spectral normalisation. The saved weights contain none of these, so this page now describes what the model file actually holds: a U-Net with a lesion mask as its attention, three down-sampling stages and instance normalisation.</p>
        </Callout>
        <H3>Next steps</H3>
        <UL>
          <LI>Save and inspect the mask, and test on the dataset’s own healthy leaves before real photos, to tell input mismatch from model failure.</LI>
          <LI>Use resize-then-convolve up-sampling, penalise a large mask, and train for longer on all 200 images per class.</LI>
          <LI>Keep samples and loss curves, and report FID and a similarity score on held-out images.</LI>
          <LI>Test whether good generated images improve a classifier on real field photos, and have plant-health experts review them.</LI>
        </UL>
        <P>
          Our dataset’s own lesions were drawn procedurally by hand-designed rules (see the <Link href="/research/dataset" className={styles.inlineLink}>Dataset</Link> page). The GAN is meant to be a separate, <em>learned</em> way to attack the same problem.
        </P>
      </Section>
    </>
  );
}
