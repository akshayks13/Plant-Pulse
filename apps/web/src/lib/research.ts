import teTables from '@/data/te-tables.json';
import modelMetrics from '@/data/model-metrics.json';
import type { TableData } from '@/components/research/ui';

/** External resources shown across the Research pages. */
export const LINKS = {
  github: 'https://github.com/akshayks13/Plant-Pulse',
  dataport: 'https://ieee-dataport.org/documents/leaf-disease-augmentation-real-world-mobile-camera-denoising-dataset',
  kaggle: 'https://www.kaggle.com/datasets/sarvesha223454/multiplant-foliar-dataset',
};

export const TEAM = {
  students: ['Akshay K S', 'Amrith B', 'Sarvesha Nandhakumar'],
  mentor: 'T. Senthil Kumar',
  school: 'Department of Computer Science and Engineering, Amrita School of Computing, Amrita Vishwa Vidyapeetham, Coimbatore',
  course: '23CSE473 case study, October 2026',
};

/** Tables parsed straight from the test-and-evaluation report (so numbers are not retyped). */
export const te = teTables as unknown as Record<string, TableData>;

export type ModelKey = 'efficientnet' | 'mobilenet' | 'densenet';
export const metrics = modelMetrics as unknown as Record<ModelKey, Record<string, number | string>>;
export const MODEL_ORDER: ModelKey[] = ['efficientnet', 'mobilenet', 'densenet'];

export const fmt = (n: number | string, d = 2) => Number(n).toFixed(d);

/** DnCNN denoising results (600 held-out test pairs, Multi-Plant Foliar dataset). */
export const DNCNN = {
  summary: {
    header: ['Method', 'PSNR (dB)', 'SSIM', 'PSNR gain (dB)'],
    rows: [
      ['Noisy input (no denoising)', '21.40 ± 1.97', '0.7935 ± 0.0639', 'reference'],
      ['Median filter 3×3', '21.41 ± 2.00', '0.8346 ± 0.0528', '+0.01'],
      ['Gaussian filter σ = 1', '21.31 ± 1.97', '0.8285 ± 0.0575', '−0.09'],
      ['DnCNN', '29.85 ± 2.14', '0.8960 ± 0.0437', '+8.45'],
    ],
  } as TableData,
  byPlant: {
    header: ['Plant', 'PSNR noisy', 'PSNR DnCNN', 'SSIM noisy', 'SSIM DnCNN', 'Gain'],
    rows: [
      ['Betel', '22.20', '30.31', '0.80', '0.89', '+8.11'],
      ['Guava', '20.43', '29.49', '0.79', '0.90', '+9.06'],
      ['Hibiscus', '21.40', '30.39', '0.80', '0.92', '+8.99'],
      ['Mint', '21.90', '30.35', '0.81', '0.92', '+8.45'],
      ['Papaya', '21.07', '28.68', '0.77', '0.86', '+7.61'],
    ],
  } as TableData,
  downstream: {
    header: ['Test input', 'Correct / 600', 'Accuracy (%)', '95% interval (± pp)'],
    rows: [
      ['Clean', '595', '99.17', '0.73'],
      ['Noisy', '582', '97.00', '1.36'],
      ['Noisy + DnCNN', '588', '98.00', '1.12'],
      ['Noisy + median 3×3', '575', '95.83', '1.60'],
    ],
  } as TableData,
  training: {
    header: ['Setting', 'Value'],
    rows: [
      ['Training / validation / test pairs', '2,800 / 600 / 600'],
      ['Loss', 'Mean squared error'],
      ['Optimiser', 'Adam, learning rate 1e−3 decayed to 1e−5 (cosine)'],
      ['Epochs, crop size, batch size', '30, 96×96, 64'],
      ['Gradient clipping', 'Norm 1.0'],
      ['Crops with re-synthesised noise', '30%'],
      ['Selected checkpoint', 'Epoch 26 (validation PSNR 29.90 dB)'],
    ],
  } as TableData,
};
