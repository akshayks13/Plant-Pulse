import type { Metadata } from 'next';
import {
  PageHero, Toc, Section, H3, P, UL, LI, Callout, DataTable, Figure, Steps,
} from '@/components/research/ui';
import { te } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Explainability — Plant-Pulse',
  description: 'Grad-CAM heat maps and confidence calibration: how we check why the model names a disease.',
};

export default function XaiPage() {
  return (
    <>
      <PageHero
        eyebrow="Explainable AI"
        title="Why did the model say that?"
        lead="A disease name is not enough if you cannot tell whether the model looked at the leaf or at the background. Explainable AI (XAI) tools show what drove a prediction. We used Grad-CAM, and we also checked that the confidence the model reports can be trusted."
      >
        <Toc items={[
          { id: 'gradcam', label: 'Grad-CAM' },
          { id: 'findings', label: 'What we found' },
          { id: 'confidence', label: 'Is the confidence honest?' },
          { id: 'inapp', label: 'In the app today' },
          { id: 'limits', label: 'Limits & next steps' },
        ]} />
      </PageHero>

      <Section id="gradcam" title="Grad-CAM in plain words" lead="Grad-CAM paints a heat map over the photo: red marks the regions that pushed the model towards its answer, blue marks regions that mattered little.">
        <Steps items={[
          { title: 'Leaf photo', desc: 'The input the model sees.' },
          { title: 'Classifier', desc: 'Predicts a disease and remembers which internal features fired.' },
          { title: 'Grad-CAM', desc: 'Weights those features by how much they raised the predicted class.', accent: true },
          { title: 'Heat map', desc: 'Overlay: strongest evidence in red.' },
        ]} />
        <P>
          It answers one useful question: <strong>is the model using the leaf?</strong> A model that cheated by reading the background (a common failure when training photos share a backdrop) would light up the wrong place.
        </P>
      </Section>

      <Section id="findings" title="What we found" lead="Eight test images from the DenseNet-121 model we put through our full test study (PlantVillage, offline): four it got right and four it got wrong.">
        <Figure
          src="/research/xai-gradcam.jpg" width={1700} height={485}
          alt="Grad-CAM heat maps for eight test leaf images, four correctly classified and four misclassified"
          caption="Top row: input with true and predicted class. Bottom row: evidence for the predicted class, strongest in red. The right four are errors."
        />
        <UL>
          <LI><strong>Correct predictions:</strong> in all four, the evidence lies on the leaf blade, not on the background.</LI>
          <LI><strong>Errors:</strong> the evidence also lies on the central leaf. The mistakes (two Corn Northern Leaf Blight images called Cercospora, an Apple scab image called healthy, and an Apple black rot image called Blueberry healthy) are look-alike lesions, not the model looking in the wrong place.</LI>
        </UL>
        <Callout kind="good" title="The reassuring result">
          <p>The model is reading the leaf. The errors come from hard-to-separate diseases, which matches the weakest classes in the accuracy results (look-alike corn lesions).</p>
        </Callout>
      </Section>

      <Section id="confidence" title="Is the confidence honest?" lead="The percentage shown next to a diagnosis is also an explanation: it tells you how sure the model is. We checked that it means what it says.">
        <P>
          The raw confidence was <strong>understated</strong>: on average about 88% while the model was right 99.5% of the time. This is a known side effect of label smoothing and MixUp in training. A single correction (a “temperature” of 0.52, fitted on validation data) fixes it without changing any prediction.
        </P>
        <DataTable table={te.t4} caption="Calibration before and after the correction (lower error is better)" wrap />
        <Figure
          src="/research/te-reliability.png" width={1500} height={630}
          alt="Reliability diagrams before and after temperature scaling"
          caption="Reliability diagrams: the closer the bars follow the dashed diagonal, the more honest the confidence. Left: raw. Right: after correction."
        />
        <P>
          Confidence also drives an “unsure” gate: when it falls below 0.6, the treatment service says the model is unsure instead of giving advice.
        </P>
      </Section>

      <Section id="inapp" title="Explanations in the app today">
        <UL>
          <LI>The <strong>confidence percentage</strong> and the <strong>runner-up diseases</strong> on every result.</LI>
          <LI>A <strong>plain-language explanation</strong> and evidence-graded treatment plan from the knowledge base.</LI>
          <LI>The <strong>“unsure” gate</strong> for low-confidence scans.</LI>
        </UL>
        <Callout kind="note">
          <p>The Grad-CAM heat maps are an offline analysis. They are <strong>not yet shown</strong> on the result page.</p>
        </Callout>
      </Section>

      <Section id="limits" title="Limits and next steps">
        <H3>What Grad-CAM cannot tell us</H3>
        <P>
          The maps come from a coarse 6 × 6 grid of features and are centre-weighted. They show that the model uses the leaf, but not that it isolates individual lesions. They are a sanity check, not proof of how the model reasons.
        </P>
        <H3>Not done yet</H3>
        <UL>
          <LI>Showing the heat map on the scan result page.</LI>
          <LI>A second, independent method (for example LIME) to see whether two explanations agree.</LI>
          <LI>A numerical test of whether the heat maps are faithful (for example deleting the highlighted pixels and watching the score drop).</LI>
          <LI>Heat maps for MobileNetV3-Large and EfficientNet-B0, the models the app uses.</LI>
        </UL>
      </Section>
    </>
  );
}
