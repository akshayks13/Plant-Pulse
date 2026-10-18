import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Toc, Section, H3, P, UL, LI, StatGrid, Stat, Callout, DataTable, HeatTable, Figure, Details,
} from '@/components/research/ui';
import { te } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Testing — Plant-Pulse',
  description: 'A test-and-evaluation study of the leaf-disease classifier using the US CDAO framework: calibration, corruptions, rotations, attacks and rare cases.',
};

export default function TestingPage() {
  return (
    <>
      <PageHero
        eyebrow="Test & evaluation"
        title="Testing the model properly"
        lead="High accuracy on a test set drawn from the same collection says little about a farmer’s phone photo. We applied the US Chief Digital and AI Office (CDAO) framework for testing AI models to see how the classifier behaves when confidence, compression, noise, rotation and deliberate attacks enter the picture."
      >
        <Toc items={[
          { id: 'summary', label: 'Scorecard' },
          { id: 'correctness', label: 'Correctness' },
          { id: 'uncertainty', label: 'Confidence' },
          { id: 'robustness', label: 'Robustness' },
          { id: 'representativeness', label: 'Unusual images' },
          { id: 'efficiency', label: 'Speed' },
          { id: 'lessons', label: 'What we learned' },
          { id: 'limits', label: 'Limits' },
        ]} />
      </PageHero>

      <Section id="about" title="What was tested">
        <P>
          The CDAO framework (April 2024) is a checklist of what a good evaluation contains: beyond accuracy it asks about <strong>interpretability, bias, robustness, resilience, uncertainty, drift, representativeness and speed</strong>, and suggests test types such as pairwise, back-to-back, metamorphic and adversarial tests. It sets no pass marks; its value is knowing what to ask.
        </P>
        <Callout kind="note" title="Scope">
          <p>The full study was run on <strong>one representative model: DenseNet-121 trained on PlantVillage</strong> (38 classes, offline). The 10,709-image official test set was never used for training or for choosing the checkpoint. Stress tests use a fixed random 1,500-image subset, and attacks use 500 of those. The Scan page serves different models (see <Link className={styles.inlineLink} href="/research/models">Models &amp; accuracy</Link>); the same stress tests have not yet been repeated on them.</p>
        </Callout>
      </Section>

      <Section id="summary" title="Scorecard">
        <StatGrid>
          <Stat value="99.56%" label="Accuracy" note="95% interval 99.43 to 99.68% on 10,709 images; 47 errors" />
          <Stat value="0.121 → 0.002" label="Calibration error" note="Fixed by one correction, with no change to any prediction" />
          <Stat value="15.7%" label="Worst case: heavy JPEG" note="At compression quality 5, with confidence still about 61%" />
          <Stat value="4.2%" label="Under a strong attack" note="10-step PGD at 2/255 on an undefended model" />
        </StatGrid>
        <DataTable table={te.t12} caption="Findings by performance dimension" wrap />
      </Section>

      <Section id="correctness" title="Correctness">
        <P>
          The model gets 99.56% of the official test images right. The interval (99.43 to 99.68%) is the figure to quote, because the checkpoint was chosen on a validation set where accuracy was 99.71%. The 47 errors concentrate in look-alike lesions; the weakest classes are Corn Cercospora / Gray leaf spot (F1 0.944), Corn Northern Leaf Blight (0.971), Apple healthy (0.982), Potato Late blight (0.983) and Tomato Target Spot (0.986). Raspberry (98.15%), Apple (98.20%) and Corn (98.36%) are the lowest crops, and six crops have no errors.
        </P>
        <DataTable table={te.t3} caption="Correctness on the PlantVillage official test set" wrap />
        <Figure narrow src="/research/te-confusion.png" width={1134} height={989} alt="Confusion matrix of the tested classifier on the validation split"
          caption="Confusion matrix on the validation split (99.71%). The few off-diagonal entries cluster within a crop." />
      </Section>

      <Section id="uncertainty" title="Confidence and calibration" lead="A model should be as sure as it is right. Raw confidence was understated: about 88% on average while the model was right 99.5% of the time.">
        <DataTable table={te.t4} caption="Calibration before and after one temperature correction (T = 0.52)" wrap />
        <Figure src="/research/te-reliability.png" width={1500} height={630} alt="Reliability diagrams before and after temperature scaling"
          caption="Reliability diagrams on the test set: raw (left) and corrected (right). The dashed line is perfect calibration." />
        <H3>Sending uncertain images to “unsure”</H3>
        <P>
          Raising the confidence needed to answer trades coverage for accuracy. The treatment service uses a threshold of 0.6, which on in-distribution test images fires for only 2 of 10,709 images: a safeguard for photos unlike the training set, not a filter for this test set.
        </P>
        <DataTable table={te.t5} caption="Accuracy against coverage" wrap />
      </Section>

      <Section id="robustness" title="Robustness: what breaks it" lead="Real photos are compressed, noisy, blurred, dark and rotated. We damaged the test images in controlled ways and measured accuracy.">
        <H3>One problem at a time</H3>
        <P>
          Low light barely matters (99.0% at one-fifth brightness) and occlusion degrades slowly. Noise, blur and heavy compression are the real weaknesses. At JPEG quality 5 accuracy is <strong>15.7% while confidence stays near 61%</strong>: the model is badly over-confident on that input. Phones and messaging apps re-compress photos all the time, so this is the most application-relevant weakness we found.
        </P>
        <HeatTable table={te.t6} to={4} min={15} max={100} caption="Accuracy (%) under single corruptions, mildest (severity 1) to strongest (severity 4)"
          note="Clean accuracy on this subset is 99.47%. Shading runs from red (low) to green (high). The last column gives the corruption strength at each severity." />
        <Figure narrow src="/research/te-robustness.png" width={1050} height={660} alt="Accuracy against corruption severity for five corruptions"
          caption="Accuracy against corruption severity (0 = clean) on the 1,500-image subset." />

        <H3>Two problems at once</H3>
        <P>
          A photo can be dark, blurred and compressed together. Pairs of problems compound: noise plus blur gives 87.6%, 8.9 points below the worse of the two alone; low light plus compression gives 92.2%, 6.3 points lower. Low light alone is harmless, so that last drop is a true interaction.
        </P>
        <HeatTable table={te.t7} from={1} to={2} min={85} max={100} caption="Accuracy (%) when two corruptions are applied together at medium strength" />

        <H3>Changes that should not matter</H3>
        <P>
          Flips, small brightness changes and a 90% zoom leave the answer unchanged in at least 99.4% of images. But a vertical flip or a 180° rotation changes it in about 7% of images. Training only used horizontal flips and rotations up to 25°, yet leaves in the field arrive at any angle.
        </P>
        <HeatTable table={te.t8} from={1} to={2} min={90} max={100} caption="Does the prediction stay the same when the leaf is flipped, rotated, brightened or zoomed?" />

        <H3>Deliberate attacks</H3>
        <P>
          A white-box attacker with access to the model can add tiny, invisible changes to a photo. A single-step attack barely matters (94.4% at 2/255) but a 10-step attack drops accuracy to 40.4% at 1/255 and 4.2% at 2/255. This is expected for an undefended network and says little about the field; it is reported because the framework requires it and because it bounds what a deliberately manipulated image can do.
        </P>
        <HeatTable table={te.t9} from={1} to={3} min={0} max={100} caption="Accuracy (%) under attack (ε in units of 1/255 of the pixel range)" />
      </Section>

      <Section id="representativeness" title="Unusual images and the data itself">
        <UL>
          <LI><strong>Imbalance:</strong> the largest training class is 33.9 times the size of the smallest, but no class is missing from any split.</LI>
          <LI><strong>Near-duplicates:</strong> 58 of 1,500 test images (3.9%) have a near-identical training image. Accuracy on them is 100% against 99.45% on the rest, inflating the headline by about 0.02 points.</LI>
          <LI><strong>Sanity baseline:</strong> a simple colour-histogram model scores 77.9% on the same images against 99.5% for the classifier, so the deep model’s accuracy comes from learned structure, not colour alone.</LI>
          <LI><strong>Rare cases:</strong> accuracy is 100% on the three quarters of images closest to the training data, 97.9% on the farthest quarter and 89.3% on the farthest 5%. Images that look unlike the training set are where the model is least reliable.</LI>
        </UL>
        <DataTable table={te.t10} caption="Accuracy by distance from the training data" wrap />
        <Figure src="/research/te-balance.png" width={1500} height={660} alt="Training images per class in descending order"
          caption="Training images per class, largest to smallest (33.9 times between the two ends)." />
      </Section>

      <Section id="efficiency" title="Speed and size">
        <DataTable table={te.t11} caption="Cost of the tested model (192 × 192 input)" wrap />
        <P>16 ms per image on a GPU and 75 ms on two CPU threads is adequate for a server-side API.</P>
      </Section>

      <Section id="interpretability" title="Interpretability">
        <P>
          Grad-CAM heat maps show the model looks at the leaf blade, not the background, for both right and wrong answers. They are coarse, so they are a sanity check. Details are on the <Link className={styles.inlineLink} href="/research/xai">Explainability</Link> page.
        </P>
      </Section>

      <Section id="lessons" title="What we learned">
        <UL>
          <LI><strong>Show a calibrated confidence.</strong> One temperature removes the calibration error at no cost in accuracy, and the 0.6 “unsure” gate then has a meaningful scale.</LI>
          <LI><strong>Treat compression and blur as input-quality problems.</strong> Accuracy is 93.7% at JPEG quality 15 and 15.7% at quality 5. A quality check before inference, and compression and noise in training, address the biggest weakness.</LI>
          <LI><strong>Train for orientation.</strong> Full-range rotation augmentation or averaging over rotations is an inexpensive remedy (see the <Link className={styles.inlineLink} href="/research/ablation">Ablation</Link> study).</LI>
          <LI><strong>Keep ImageNet pretraining.</strong> It is the one training ingredient whose removal clearly hurts every model.</LI>
        </UL>
      </Section>

      <Section id="limits" title="Limits of this study">
        <Callout kind="caveat" title="Read the results with these in mind">
          <p><strong>In-distribution only:</strong> every result concerns PlantVillage-style single-leaf images, and no field photograph was evaluated. In our own informal checks on photographs from other public sources, the application’s models were right only about a third of the time.</p>
          <p><strong>One model, one training run</strong> was used for testing; a repeat run differed by about 0.06 points. <strong>Damage was simulated</strong> (noise, blur, JPEG and low light are not camera-captured) and the attacks are digital. <strong>Labels and treatment content</strong> come from the dataset authors and were not reviewed by plant pathologists.</p>
        </Callout>
        <Details summary="What the framework asks for that we did not do">
          <UL>
            <LI><strong>Drift monitoring, A/B testing, red-team and live field tests</strong> need a deployed application, users or repeated retraining.</LI>
            <LI><strong>Cross-validation</strong> was not run.</LI>
            <LI><strong>Resilience</strong> does not apply: the model keeps no state between images.</LI>
            <LI><strong>Calibration, stress and attack tests on the other two backbones</strong> remain to be done.</LI>
          </UL>
        </Details>
      </Section>
    </>
  );
}
