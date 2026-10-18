import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Toc, Section, H3, P, UL, LI, Callout, DataTable, BarChart, Figure, MiniCard, ButtonLink,
} from '@/components/research/ui';
import { metrics, MODEL_ORDER, fmt, te, type ModelKey } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Models & accuracy — Plant-Pulse',
  description: 'Accuracy, calibration, speed and size of the three leaf-disease models used by Plant-Pulse.',
};

const TAGS: Record<ModelKey, string> = {
  efficientnet: 'Highest accuracy · default in the app',
  mobilenet: 'Fastest · suited to phones',
  densenet: 'Largest · most computation',
};

const m = (k: ModelKey, f: string) => metrics[k][f] as number;
const names = MODEL_ORDER.map(k => metrics[k].name as string);

const FULL = {
  header: ['Measure', ...names],
  rows: [
    ['Top-1 accuracy (%)', ...MODEL_ORDER.map(k => fmt(m(k, 'accuracy_top1')))],
    ['Top-3 / Top-5 accuracy (%)', ...MODEL_ORDER.map(k => `${fmt(m(k, 'top_3_accuracy'), 1)} / ${fmt(m(k, 'top_5_accuracy'), 1)}`)],
    ['Misclassified images (of 1,200)', ...MODEL_ORDER.map(k => String(m(k, 'misclassified_samples')))],
    ['Macro precision (%)', ...MODEL_ORDER.map(k => fmt(m(k, 'precision_macro')))],
    ['Macro recall (%)', ...MODEL_ORDER.map(k => fmt(m(k, 'recall_macro')))],
    ['Macro F1 (%)', ...MODEL_ORDER.map(k => fmt(m(k, 'f1_macro')))],
    ['Balanced accuracy (%)', ...MODEL_ORDER.map(k => fmt(m(k, 'balanced_accuracy')))],
    ['Cohen’s kappa', ...MODEL_ORDER.map(k => fmt(m(k, 'cohen_kappa'), 4))],
    ['Matthews correlation (MCC)', ...MODEL_ORDER.map(k => fmt(m(k, 'mcc'), 4))],
    ['ROC-AUC (macro, one-vs-rest)', ...MODEL_ORDER.map(k => fmt(m(k, 'roc_auc_macro_ovr'), 4))],
    ['Log loss (lower is better)', ...MODEL_ORDER.map(k => fmt(m(k, 'log_loss'), 3))],
    ['Expected calibration error (lower is better)', ...MODEL_ORDER.map(k => fmt(m(k, 'expected_calibration_error'), 3))],
  ],
};

const COST = {
  header: ['Cost', ...names],
  rows: [
    ['Trainable parameters (millions)', ...MODEL_ORDER.map(k => fmt(m(k, 'trainable_parameters_m')))],
    ['Compute (GMACs per image, 224×224)', ...MODEL_ORDER.map(k => fmt(m(k, 'theoretical_gmacs')))],
    ['Model file size, FP32 (MB)', ...MODEL_ORDER.map(k => fmt(m(k, 'fp32_size_mb')))],
    ['GPU latency (ms per image)', ...MODEL_ORDER.map(k => `${fmt(m(k, 'gpu_latency_mean_ms'))} ± ${fmt(m(k, 'gpu_latency_std_ms'))}`)],
    ['Training time (seconds)', ...MODEL_ORDER.map(k => String(Math.round(m(k, 'training_time_seconds'))))],
  ],
};

const NOISE = {
  header: ['Test images', ...names],
  rows: [
    ['Clean (600 images)', '100.00', '99.67', '99.67'],
    ['Noisy mobile-camera copies (600 images)', '100.00', '99.67', '99.67'],
    ['Gap', '0.00', '0.00', '0.00'],
  ],
};

const SETUP = {
  header: ['Setting', 'EfficientNet-B0', 'MobileNetV3-Large', 'DenseNet-121'],
  rows: [
    ['Starting weights', 'ImageNet-1K', 'ImageNet-1K', 'ImageNet-1K'],
    ['Optimiser, weight decay', 'AdamW, 1e−4', 'AdamW, 1e−4', 'AdamW, 1e−4'],
    ['Learning rate', '5e−4', '5e−4', '2e−4'],
    ['Schedule', 'Cosine to 1e−6, 12 epochs', 'Cosine to 1e−6, 12 epochs', 'Cosine to 1e−6, 12 epochs'],
    ['Head dropout, drop-path', '0.30, 0.10', '0.10, 0.10', '0.20, none'],
    ['Label smoothing, gradient clipping', '0.1, 1.0', '0.1, 1.0', '0.1, 1.0'],
    ['Batch size, precision', '32, mixed (FP16/BF16)', '32, mixed (FP16/BF16)', '32, mixed (FP16/BF16)'],
  ],
};

const LITERATURE = {
  header: ['Published study', 'Model', 'Accuracy (%)', 'Split'],
  rows: [
    ['Mohanty et al.', 'GoogLeNet', '99.35', 'Random'],
    ['Too et al.', 'DenseNet-121', '99.75', 'Benchmark'],
    ['Nigar et al.', 'EfficientNet-B0', '99.69', 'Stratified'],
    ['Karthikeyan et al.', 'SE-CNN', '99.29', 'Held-out'],
  ],
};

const PV_CARD_META = [
  { match: 'DenseNet-121', tag: 'Used in our full test study', sub: 'official test set, 10,709 images' },
  { match: 'MobileNetV3-Large', tag: 'Official test split', sub: 'official test set, 10,709 images' },
  { match: 'EfficientNet-B0', tag: 'Easiest split, least conservative', sub: 'stratified 15% split, 8,146 images' },
];

const pvCards = PV_CARD_META.map(meta => {
  const row = te.t19.rows.find(r => r[0].startsWith(meta.match))!;      // Model | set | n | acc | F1 | top-3 | ECE | params
  const ctrl = te.t17.rows.find(r => r[0] === meta.match)!;              // Backbone | clean | perturbed | ...
  return {
    name: meta.match, tag: meta.tag, sub: meta.sub,
    acc: row[3], f1: row[4], top3: row[5], ece: row[6] === 'n/m' ? 'not measured' : row[6], params: row[7],
    clean20: ctrl[1].split(' ')[0], damaged20: ctrl[2].split(' ')[0],
  };
});

export default function ModelsPage() {
  return (
    <>
      <PageHero
        eyebrow="Models & accuracy"
        title="How accurate are our three models?"
        lead="The Scan page lets you choose between three ImageNet-pretrained networks. All three were trained the same way on our Multi-Plant dataset (20 classes) and tested on 1,200 images they had never seen: 600 clean and 600 with mobile-camera noise. Most of our formal testing used the public PlantVillage benchmark instead; those results are at the bottom of this page."
      >
        <Toc items={[
          { id: 'scorecard', label: 'Scorecard' },
          { id: 'metrics', label: 'All metrics' },
          { id: 'cost', label: 'Speed & size' },
          { id: 'noise', label: 'Noisy images' },
          { id: 'confusion', label: 'Confusion matrices' },
          { id: 'setup', label: 'Training setup' },
          { id: 'plantvillage', label: 'PlantVillage' },
        ]} />
      </PageHero>

      <Section id="scorecard" title="Scorecard">
        <div className={styles.modelCards}>
          {MODEL_ORDER.map(k => (
            <div key={k} className={styles.modelCard}>
              <div className={styles.modelName}>{metrics[k].name as string}</div>
              <span className={styles.modelTag}>{TAGS[k]}</span>
              <div className={styles.modelAcc}>{fmt(m(k, 'accuracy_top1'))}%</div>
              <div className={styles.modelAccSub}>
                top-1 accuracy · {m(k, 'misclassified_samples')} error{m(k, 'misclassified_samples') === 1 ? '' : 's'} in 1,200 images
              </div>
              <dl className={styles.kv}>
                <dt>Macro F1</dt><dd>{fmt(m(k, 'f1_macro'))}%</dd>
                <dt>Parameters</dt><dd>{fmt(m(k, 'trainable_parameters_m'))} M</dd>
                <dt>Speed (GPU)</dt><dd>{fmt(m(k, 'gpu_latency_mean_ms'), 1)} ms</dd>
                <dt>File size</dt><dd>{fmt(m(k, 'fp32_size_mb'), 1)} MB</dd>
              </dl>
            </div>
          ))}
        </div>

        <div className={styles.chartGrid}>
          <BarChart
            title="Top-1 accuracy (%)" sub="higher is better"
            axisMin={99} axisMax={100}
            items={MODEL_ORDER.map(k => ({ label: metrics[k].name as string, value: m(k, 'accuracy_top1'), display: fmt(m(k, 'accuracy_top1')) }))}
          />
          <BarChart
            title="Speed: milliseconds per image" sub="lower is better · laptop RTX 3050 GPU"
            items={MODEL_ORDER.map(k => ({ label: metrics[k].name as string, value: m(k, 'gpu_latency_mean_ms'), display: `${fmt(m(k, 'gpu_latency_mean_ms'), 1)} ms` }))}
          />
          <BarChart
            title="Size: millions of parameters" sub="lower is lighter"
            items={MODEL_ORDER.map(k => ({ label: metrics[k].name as string, value: m(k, 'trainable_parameters_m'), display: `${fmt(m(k, 'trainable_parameters_m'))} M` }))}
          />
          <BarChart
            title="Computation: GMACs per image" sub="lower is cheaper"
            items={MODEL_ORDER.map(k => ({ label: metrics[k].name as string, value: m(k, 'theoretical_gmacs'), display: fmt(m(k, 'theoretical_gmacs')) }))}
          />
        </div>

        <Callout kind="caveat" title="The three models are effectively tied on accuracy">
          <p>EfficientNet-B0 made no mistakes and the other two made four each: a difference of four images out of 1,200. Statistically the three cannot be told apart (their 95% confidence intervals overlap). The differences that are real are in cost: MobileNetV3-Large needs about 13 times less computation than DenseNet-121 and runs 2.6 times faster.</p>
          <p>Our dataset is also deliberately easy: its disease patterns were generated to be clearly separable, so scores near 100% are expected. These numbers show the task is learned well, not that real garden photos will score the same.</p>
        </Callout>
      </Section>

      <Section id="metrics" title="All metrics" lead="Held-out test set of 1,200 images (clean and noisy combined). Higher is better except for log loss and calibration error.">
        <DataTable table={FULL} caption="Classification results on the Multi-Plant test set" wrap />
        <P>
          <strong>Top-3 and top-5 accuracy</strong> count a prediction as right if the true disease is among the model’s three (or five) best guesses. <strong>Macro F1</strong> averages the score of every class equally, so rare classes count as much as common ones. <strong>Calibration error</strong> measures whether a stated confidence matches how often the model is actually right: all three understate their confidence a little (about 0.09), which is a side effect of label smoothing during training.
        </P>
      </Section>

      <Section id="cost" title="Speed and size">
        <DataTable table={COST} caption="Cost of running each model (224 × 224 input, laptop RTX 3050 GPU)" wrap />
        <UL>
          <LI><strong>MobileNetV3-Large</strong> is the best fit for a phone or edge device: 0.22 GMACs, 16 MB, about 144 images per second.</LI>
          <LI><strong>EfficientNet-B0</strong> gives the best accuracy for its size (4 million parameters, 15 MB) and is the default model in the app.</LI>
          <LI><strong>DenseNet-121</strong> is the heaviest (2.88 GMACs) with no accuracy advantage on this data.</LI>
        </UL>
      </Section>

      <Section id="noise" title="Noisy images" lead="Half of the test images are mobile-camera copies with sensor grain, shot noise, impulse noise and blur.">
        <DataTable table={NOISE} caption="Accuracy (%) on clean and noisy test images" strongRow={r => r[0] === 'Gap'} wrap />
        <Callout kind="note" title="Why the gap is zero, and why that is not the whole story">
          <p>The models were trained on both clean and noisy copies, so they have seen this kind of noise. The test noise also comes from the same generator. Zero gap therefore shows the models handle <em>this</em> noise, not noise from real phones. When we added strong synthetic noise to PlantVillage images, a DenseNet-121 model’s accuracy fell to 65% (see the Testing page).</p>
        </Callout>
        <Figure narrow
          src="/research/multiplant-noise.png" width={1400} height={840}
          alt="Chart comparing clean and noisy accuracy of the three models"
          caption="Clean versus noisy accuracy on the Multi-Plant test set."
        />
      </Section>

      <Section id="confusion" title="Where the errors are" lead="Normalised confusion matrices: a bright diagonal means the model names the right disease. Off-diagonal cells are mix-ups.">
        <div className={styles.figRow}>
          <Figure src="/research/cm-efficientnet.jpg" width={1100} height={943} alt="Confusion matrix of EfficientNet-B0" caption="EfficientNet-B0: no errors." />
          <Figure src="/research/cm-mobilenet.jpg" width={1100} height={943} alt="Confusion matrix of MobileNetV3-Large" caption="MobileNetV3-Large: 4 errors." />
          <Figure src="/research/cm-densenet.jpg" width={1100} height={943} alt="Confusion matrix of DenseNet-121" caption="DenseNet-121: 4 errors." />
        </div>
      </Section>

      <Section id="setup" title="Training setup">
        <DataTable table={SETUP} caption="How each model was trained (same data, split 70 / 15 / 15)" wrap />
        <P>
          Each network starts from ImageNet weights and is fine-tuned for 12 epochs on 5,600 images, validated on 1,200 and tested on 1,200. Whether those starting weights matter is answered on the <Link href="/research/ablation" className={styles.inlineLink}>Ablation</Link> page: in our PlantVillage experiments, removing them cost 10 to 21 points of accuracy.
        </P>
      </Section>

      <Section
        id="plantvillage" compact
        kicker="Reference · most of our formal testing used this data"
        title="PlantVillage models (38 classes)"
        lead="PlantVillage is the well-known public benchmark: 54,305 single-leaf photos of 14 crops on plain backgrounds. We trained the same three architectures on it to compare with published work, and it is the data behind our test study and ablation. These models are evaluated offline: the Scan page serves the 20-class Multi-Plant models above."
      >
        <div className={styles.pvCards}>
          {pvCards.map(c => (
            <div key={c.name} className={styles.modelCard}>
              <div className={styles.modelName}>{c.name}</div>
              <span className={styles.modelTag}>{c.tag}</span>
              <div className={styles.modelAcc}>{c.acc}%</div>
              <div className={styles.modelAccSub}>top-1 accuracy · {c.sub}</div>
              <dl className={styles.kv}>
                <dt>Macro F1</dt><dd>{c.f1}%</dd>
                <dt>Top-3 accuracy</dt><dd>{c.top3}%</dd>
                <dt>Calibration error</dt><dd>{c.ece}</dd>
                <dt>Parameters</dt><dd>{c.params} M</dd>
                <dt>20% data: clean / damaged</dt><dd>{c.clean20} / {c.damaged20}%</dd>
              </dl>
            </div>
          ))}
        </div>

        <DataTable compact table={te.t19} caption="Held-out accuracy of our three PlantVillage models" strongRow={r => r[0] === 'DenseNet-121'} wrap
          note="The protocols differ between rows, so this comparison is indicative. DenseNet-121 and MobileNetV3-Large were tested on the same official test split with a leaf-grouped training split; EfficientNet-B0 used a stratified split that is not grouped by leaf, so it is the least conservative estimate. n/m means not measured." />

        <DataTable compact table={te.t17} caption="Like for like: same 20% training slices, same test sets, three seeds (mean ± standard deviation)" wrap
          note="Here every model saw identical data, so differences are fairer to compare. EfficientNet-B0 has the highest clean accuracy and the shortest training time. MobileNetV3-Large scores highest on damaged images, but that gap is within seed noise. Accuracy is lower than the table above because only 20% of the training data was used." />

        <div className={styles.twoCol}>
          <DataTable compact table={LITERATURE} caption="Published results on PlantVillage (all 38 classes), for context" wrap
            note="Quoted from the literature; protocols differ, so they are not directly comparable with ours." />
          <DataTable compact table={te.t20} caption="DenseNet-121 accuracy by crop (official test set, lowest first)"
            note="Six crops have no errors. The 47 errors concentrate in look-alike lesions." />
        </div>

        <H3>Where this data was used</H3>
        <div className={styles.miniGrid}>
          <MiniCard href="/research/testing" label="Test & evaluation" value="99.56%"
            desc="DenseNet-121 on 10,709 official test images (95% interval 99.43 to 99.68%), then stress-tested for calibration, compression, noise, rotation and attacks." />
          <MiniCard href="/research/ablation" label="Ablation study" value="72 models"
            desc="Three backbones, up to eight training ingredients removed one at a time, three seeds each. ImageNet pretraining matters most." />
          <MiniCard href="/research/xai" label="Explainability" value="Grad-CAM"
            desc="Heat maps on right and wrong predictions show the model reads the leaf, not the background." />
        </div>
      </Section>

      <div className={styles.heroActions} style={{ marginTop: 40 }}>
        <ButtonLink href="/research/testing" primary>How we tested it</ButtonLink>
        <ButtonLink href="/scan">Try the models</ButtonLink>
      </div>
    </>
  );
}
