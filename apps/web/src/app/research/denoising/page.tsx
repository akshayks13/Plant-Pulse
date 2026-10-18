import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Toc, Section, H3, P, UL, LI, StatGrid, Stat, Callout, DataTable, HeatTable, Figure, Steps, BarChart, ButtonLink,
} from '@/components/research/ui';
import { DNCNN, LINKS } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Denoising with DnCNN — Plant-Pulse',
  description: 'A residual CNN denoiser for noisy phone photos of leaves: +8.45 dB image quality, and its effect on disease classification.',
};

export default function DenoisingPage() {
  return (
    <>
      <PageHero
        eyebrow="Image restoration"
        title="Denoising leaf photos with DnCNN"
        lead="A photo taken on a phone in poor light carries grain, dropped pixels and blur. DnCNN is a neural network that learns to remove that noise before the image reaches the classifier. We trained it on our paired clean and noisy leaf images."
      >
        <Toc items={[
          { id: 'idea', label: 'The idea' },
          { id: 'results', label: 'Image quality' },
          { id: 'examples', label: 'Examples' },
          { id: 'classification', label: 'Effect on classification' },
          { id: 'how', label: 'How it was trained' },
          { id: 'limits', label: 'Limitations' },
        ]} />
      </PageHero>

      <Section id="idea" title="The idea">
        <Steps items={[
          { title: 'Noisy leaf', desc: 'Phone photo with sensor noise, impulses and blur.' },
          { title: 'DnCNN', desc: 'Predicts the noise in the image and subtracts it.', accent: true },
          { title: 'Restored leaf', desc: 'A cleaner image, closer to what the camera should have captured.' },
          { title: 'Classifier', desc: 'Names the disease from the restored image.' },
        ]} />
        <Callout kind="note" title="Status">
          <p>DnCNN is a research result. It is <strong>not yet part of the Scan page</strong>: photos you upload are sent to the classifier as they are.</p>
        </Callout>
      </Section>

      <Section id="results" title="Image quality: +8.45 dB" lead="Measured on 600 held-out pairs the network never saw. PSNR measures pixel accuracy against the clean image (higher is better); SSIM measures structural similarity (1 is identical).">
        <StatGrid>
          <Stat value="21.40 → 29.85 dB" label="Average PSNR" note="+8.45 dB; every one of the 600 test images improved (1.8 to 12.7 dB)" />
          <Stat value="0.794 → 0.896" label="Average SSIM" note="Better structural similarity on all 600 images" />
          <Stat value="0.56 M" label="Parameters" note="A small network: a 2 MB file" />
        </StatGrid>
        <DataTable table={DNCNN.summary} caption="Test-set reconstruction quality (mean ± standard deviation across 600 images)" strongRow={r => r[0] === 'DnCNN'} wrap
          note="The classical filters raise SSIM a little but leave PSNR unchanged: they smooth the noise but also remove leaf texture and edges, which PSNR counts as error." />
        <BarChart title="Average PSNR (dB)" sub="higher is better" axisMin={20} axisMax={30}
          items={[
            { label: 'Noisy input', value: 21.40, display: '21.40' },
            { label: 'Median 3×3', value: 21.41, display: '21.41' },
            { label: 'Gaussian σ=1', value: 21.31, display: '21.31' },
            { label: 'DnCNN', value: 29.85, display: '29.85' },
          ]} />
        <Figure narrow src="/research/dncnn-scatter.png" width={900} height={823} alt="Scatter plot of image quality before and after DnCNN for every test image"
          caption="Every test image, before (horizontal) and after (vertical) denoising. All 600 lie above the dashed no-change line." />
        <H3>By plant</H3>
        <HeatTable table={DNCNN.byPlant} from={5} to={5} min={7} max={10}
          caption="Mean PSNR (dB) and SSIM by plant (120 test images each); shading shows the gain" />
        <P>The gain is steady across plants (7.6 to 9.1 dB). Papaya scores lowest after denoising and has the smallest gain; guava starts lowest and gains the most.</P>
      </Section>

      <Section id="examples" title="Examples" lead="From left to right: noisy input, 3×3 median filter, DnCNN, clean target. The rows show the weakest, a typical, the strongest and a random result.">
        <Figure src="/research/dncnn-examples.jpg" width={1500} height={1500} alt="Four leaf images shown noisy, median filtered, DnCNN restored and clean"
          caption="The median filter output looks much like the noisy input, matching its unchanged PSNR, while DnCNN is visibly closer to the clean target in vein detail and lesion texture." />
      </Section>

      <Section id="classification" title="Does denoising help the classifier?" lead="We trained a MobileNetV3-Large classifier on clean images only, then tested it on the same 600 test leaves in four forms.">
        <DataTable table={DNCNN.downstream} caption="Disease-classification accuracy on 600 test images" strongRow={r => r[0] === 'Noisy + DnCNN'} wrap />
        <Figure narrow src="/research/dncnn-downstream.png" width={1040} height={720} alt="Bar chart of classifier accuracy on clean, noisy, DnCNN-restored and median-filtered images"
          caption="Accuracy with 95% intervals. Note the axis starts at 93%." />
        <UL>
          <LI>Noise costs the classifier <strong>2.2 points</strong> (99.17% to 97.00%).</LI>
          <LI>DnCNN wins back <strong>1.0 point</strong>, about 46% of the loss.</LI>
          <LI>The median filter made things slightly <strong>worse</strong> than doing nothing (95.83%).</LI>
        </UL>
        <Callout kind="caveat" title="Suggestive, not proven">
          <p>The DnCNN gain is 6 images out of 600, and the confidence intervals overlap. We can say the direction is right, not that the benefit is established. The 8.45 dB image-quality gain is the firm result. Showing a clear classification benefit needs a harder test set, such as real phone photos.</p>
        </Callout>
      </Section>

      <Section id="how" title="How it was trained">
        <P>
          DnCNN has 17 convolutional layers with batch normalisation. Instead of predicting the clean image directly, it predicts the <em>noise</em> and subtracts it (<em>restored = noisy − predicted noise</em>), a trick called residual learning that makes training easier. It was trained on 96 × 96 crops of the 2,800 training pairs. For 30% of crops, fresh noise (Gaussian, Poisson, salt-and-pepper or blur of random strength) replaced the dataset’s own noise so the network does not just memorise one noise recipe. Testing always used the dataset’s own noisy images.
        </P>
        <DataTable table={DNCNN.training} caption="Training settings" wrap />
        <Figure src="/research/dncnn-curves.png" width={1500} height={525} alt="Training error and validation image quality per epoch"
          caption="Training error (left) falls steadily; validation image quality (right) is erratic early and settles near 29.9 dB. The best checkpoint (epoch 26) was kept. Validation (29.90 dB) and test (29.85 dB) agree." />
      </Section>

      <Section id="limits" title="Limitations">
        <UL>
          <LI><strong>Synthetic data.</strong> Clean and noisy images are both generated; real phone photos are untested.</LI>
          <LI><strong>Random split.</strong> Images made from the same source photo may appear in both training and test sets, which would make the numbers optimistic. We could not measure how much.</LI>
          <LI><strong>One training run.</strong> The ± values describe variation between images, not between training runs.</LI>
          <LI><strong>No other denoisers compared.</strong> We did not test U-Net, ResUNet or BM3D, and did not test the effect of the 30% re-synthesised noise.</LI>
        </UL>
        <div className={styles.heroActions}>
          <ButtonLink href={LINKS.kaggle} external primary>Get the paired dataset</ButtonLink>
          <Link href="/research/dataset" className={styles.btn}>About the dataset</Link>
        </div>
      </Section>
    </>
  );
}
