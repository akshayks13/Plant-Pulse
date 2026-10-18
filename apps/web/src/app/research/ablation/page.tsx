import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import {
  PageHero, Toc, Section, H3, P, UL, LI, StatGrid, Stat, Callout, DataTable, DeltaTable, Figure, Details,
} from '@/components/research/ui';
import { te } from '@/lib/research';

export const metadata: Metadata = {
  title: 'Ablation study — Plant-Pulse',
  description: '72 trained models show which training ingredients matter for DenseNet-121, MobileNetV3-Large and EfficientNet-B0.',
};

export default function AblationPage() {
  return (
    <>
      <PageHero
        eyebrow="Ablation study"
        title="What really matters in training?"
        lead="Training a plant-disease model involves many ingredients: pretrained weights, label smoothing, rotation, colour changes and more. An ablation study removes one ingredient at a time and measures the damage, so we learn which ones earn their place."
      >
        <Toc items={[
          { id: 'headline', label: 'Headline' },
          { id: 'design', label: 'How it was run' },
          { id: 'clean', label: 'Clean accuracy' },
          { id: 'perturbed', label: 'Damaged images' },
          { id: 'confidence', label: 'Confidence' },
          { id: 'findings', label: 'Component by component' },
          { id: 'compare', label: 'Backbone comparison' },
          { id: 'limits', label: 'What it cannot show' },
        ]} />
      </PageHero>

      <Section id="headline" title="Headline">
        <StatGrid>
          <Stat value="72" label="Models trained" note="3 backbones × up to 9 variants (baseline + each component removed) × 3 random seeds" />
          <Stat value="−10.7 to −20.8" label="Points without ImageNet pretraining" note="Clean accuracy drop: DenseNet-121 −10.7, MobileNetV3 −18.0, EfficientNet-B0 −20.8" />
          <Stat value="3 of 3" label="Backbones: label smoothing lowers confidence" note="Removing it improves log loss in every model: it is why raw confidence was understated" />
        </StatGrid>
        <Callout kind="good" title="The one clear result">
          <p><strong>ImageNet pretraining is the only ingredient whose removal clearly hurts all three backbones.</strong> The lighter networks lose the most. Every other ingredient showed no reliable effect on clean accuracy at this scale.</p>
        </Callout>
      </Section>

      <Section id="design" title="How it was run">
        <UL>
          <LI><strong>Three backbones</strong> (DenseNet-121, MobileNetV3-Large, EfficientNet-B0), each under its own training recipe.</LI>
          <LI><strong>One ingredient removed at a time</strong>: MixUp or CutMix, label smoothing, random erasing, rotation or affine augmentation, colour jitter, ImageNet pretraining, the cosine learning-rate schedule and gradient clipping. EfficientNet-B0’s recipe has no MixUp, random erasing or gradient clipping, so six variants apply to it.</LI>
          <LI><strong>Three seeds</strong> per variant, on the same stratified, leaf-grouped 20% slice of the PlantVillage training set (7,079 images), so every comparison is paired. The model after the <em>last</em> epoch is tested: no checkpoint picking.</LI>
          <LI><strong>Three test sets:</strong> the 10,709-image clean test set; its leaf-disjoint part (no leaf shared with training); and a perturbed copy where every image gets a random rotation (0 to 360°), brightness ×0.6 to 1.4, contrast ×0.7 to 1.3, blur up to 1.8 px and noise up to 14 grey levels.</LI>
        </UL>
        <Details summary="Show each backbone’s training recipe">
          <DataTable table={te.t13} caption="Training recipes (each ablation removes one component of the backbone’s own recipe)" wrap />
        </Details>
      </Section>

      <Section id="clean" title="Effect on clean accuracy" lead="Change in accuracy when the ingredient is removed, with a 95% interval across the paired seeds. Colour appears only when the interval excludes zero.">
        <DeltaTable table={te.t14} caption="Accuracy change (points) on the clean test set when each ingredient is removed"
          note="— means the ingredient is not part of that backbone’s recipe. Baselines are mean ± standard deviation over 3 seeds." />
        <Figure src="/research/ablation-forest.png" width={1500} height={818} alt="Paired change in accuracy relative to each backbone's baseline with intervals"
          caption="Paired change in accuracy relative to each backbone’s baseline, with 95% intervals, on the clean (top) and perturbed (bottom) test sets. ImageNet pretraining is left out and shown next." />
        <Figure src="/research/ablation-pretraining.png" width={1500} height={602} alt="Effect of removing ImageNet pretraining on each backbone"
          caption="Removing ImageNet pretraining hurts every backbone, by 10 to 21 points of clean accuracy." />
      </Section>

      <Section id="perturbed" title="Effect on damaged images" lead="The perturbed test set rotates, dims, blurs and adds noise to every image, closer to what a phone camera delivers.">
        <DeltaTable table={te.t15} caption="Accuracy change (points) on the perturbed test set when each ingredient is removed" />
      </Section>

      <Section id="confidence" title="Effect on confidence" lead="Log loss measures both accuracy and how honest the confidence is; lower is better, so a negative change means removing the ingredient made things better.">
        <DeltaTable lowerIsBetter table={te.t16} caption="Log-loss change on the clean test set when each ingredient is removed" />
        <P>
          Removing label smoothing lowers log loss in all three backbones (for example DenseNet-121 from 0.217 to 0.073). Label smoothing therefore explains the <em>understated confidence</em> seen on the <Link className={styles.inlineLink} href="/research/testing">Testing</Link> page.
        </P>
      </Section>

      <Section id="findings" title="Component by component">
        <UL>
          <LI><strong>ImageNet pretraining:</strong> removing it costs 10.7, 18.0 and 20.8 points of clean accuracy and 21.3, 25.0 and 34.6 points on damaged images, multiplying the error rate by 7.8, 10.0 and 15.7. The two lighter networks lose more than DenseNet-121.</LI>
          <LI><strong>Label smoothing:</strong> no effect on DenseNet-121 accuracy, −0.66 for MobileNetV3-Large (not established) and −0.29 for EfficientNet-B0 (worse in all three seeds). On damaged images it costs MobileNetV3-Large 2.6 points and EfficientNet-B0 1.0.</LI>
          <LI><strong>Rotation (MobileNetV3-Large):</strong> without ±180° rotation, clean accuracy <em>rises</em> 0.63 points but accuracy on damaged images <em>falls</em> 6.1 points in all three seeds. Rotation costs a little in-distribution accuracy and buys robustness to rotated photos, though the robustness gain is not established with three seeds. DenseNet-121 and EfficientNet-B0 point the same way with intervals that include zero.</LI>
          <LI><strong>Random erasing:</strong> costs MobileNetV3-Large 3.8 points on damaged images (all three seeds) and nothing on clean ones.</LI>
          <LI><strong>Colour jitter:</strong> no effect on clean accuracy; on damaged images, removing it costs EfficientNet-B0 5.2 points (all three seeds) and MobileNetV3-Large 6.0 (not established).</LI>
          <LI><strong>Cosine schedule:</strong> a constant rate costs DenseNet-121 0.58 and EfficientNet-B0 0.35 points, worse in every seed but within noise. No effect for MobileNetV3-Large, whose schedule is stopped early.</LI>
          <LI><strong>MixUp / CutMix and gradient clipping:</strong> no detectable effect on accuracy. MixUp lowers DenseNet-121’s log loss by 0.057.</LI>
        </UL>
        <H3>The robustness gap</H3>
        <P>
          The gap between clean and damaged accuracy is 15.9 ± 3.0 points for DenseNet-121, 9.6 ± 1.4 for MobileNetV3-Large and 13.3 ± 0.2 for EfficientNet-B0. Removing pretraining widens it to 26.5, 16.6 and 27.2 points. Removing rotation widens MobileNetV3-Large’s gap from 9.6 to 16.4, and removing colour jitter widens EfficientNet-B0’s from 13.3 to 18.4.
        </P>
      </Section>

      <Section id="compare" title="Backbone comparison under one protocol" lead="Because every model saw the same training slices and test sets, the baselines are directly comparable (with the caveat that each keeps its own recipe).">
        <DataTable table={te.t17} caption="Baselines under the ablation protocol (mean ± standard deviation over 3 seeds)" wrap />
        <UL>
          <LI><strong>EfficientNet-B0</strong> has the highest clean accuracy (98.59%) and the shortest training time (5.6 minutes per run).</LI>
          <LI><strong>MobileNetV3-Large</strong> scores highest on damaged images (88.4%), the backbone trained with full-range rotation. Its lead over the others on damaged images is within seed noise.</LI>
        </UL>
      </Section>

      <Section id="limits" title="What the ablation cannot show">
        <Callout kind="caveat" title="Absence of evidence is not evidence of absence">
          <p>With three seeds the interval is wide, so effects smaller than about 0.5 points cannot be detected. Where an interval includes zero, the result means “not established”, not “no effect”.</p>
          <p>Training used 20% of the data and the last epoch, so baselines (98.0 to 98.6%) sit below our full-data models, and effects may differ at full scale. Each backbone also used its own recipe, learning rate and epoch budget, so a difference between backbones mixes architecture and recipe.</p>
        </Callout>
      </Section>
    </>
  );
}
