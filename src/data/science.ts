// The Science Behind CutOut: references, measurements and provenance.
//
// Three kinds of statement appear on the page, and every one is tagged with its kind:
//   app     — what CutOut's own code does. Verified against the engine source of CutOut 0.1,
//             published at github.com/ca-works/cutout-app (commit 54db95b, 8 November 2026; the
//             engine files are byte-identical to the development tree that was read).
//   paper   — how the BiRefNet authors (or another cited paper) describe their method.
//   concept — general background to help the reader; not a claim about CutOut's pipeline.
// See docs/SCIENCE.md for the full claim → evidence map. Change a number here only together
// with a new measurement.

export type Kind = 'app' | 'paper' | 'concept';

export const kindLabel: Record<Kind, string> = {
  app: 'In CutOut',
  paper: 'In the paper',
  concept: 'Concept',
};

export const kindTitle: Record<Kind, string> = {
  app: 'Verified in CutOut 0.1’s published source code, or measured by running it',
  paper: 'As described by the authors of the cited research',
  concept: 'General background, not a description of CutOut’s own code',
};

export interface Ref {
  id: string;
  authors: string;
  title: string;
  where: string;
  year: string;
  url: string;
  note?: string;
}

/** Numbered in this order on the page. Every URL was opened on 8 November 2026. */
const SRC = 'https://github.com/ca-works/cutout-app/blob/54db95bc09958373abf44aa66071371c2244c982';
export const refs: Ref[] = [
  {
    id: 'cutout-src',
    authors: 'ca-works',
    title: 'CutOut engine source code',
    where: 'GitHub, ca-works/cutout-app, core/src at commit 54db95b',
    year: '2026',
    url: 'https://github.com/ca-works/cutout-app/tree/54db95bc09958373abf44aa66071371c2244c982/core/src',
    note: 'Pre-processing, inference and refinement (ai.rs, filters.rs), compositing, brushes, selections, colour and geometry. MIT licence.',
  },
  {
    id: 'cutout-models',
    authors: 'ca-works',
    title: 'Background-removal model analysis',
    where: 'GitHub, ca-works/cutout-app, docs/MODELS.md',
    year: '2026',
    url: `${SRC}/docs/MODELS.md`,
    note: 'Model choice, pinned files and hashes, benchmark scenes, Core ML conversion and parity.',
  },
  {
    id: 'birefnet',
    authors: 'P. Zheng, D. Gao, D.-P. Fan, L. Liu, J. Laaksonen, W. Ouyang, N. Sebe',
    title: 'Bilateral Reference for High-Resolution Dichotomous Image Segmentation',
    where: 'CAAI Artificial Intelligence Research 3, 9150038',
    year: '2024',
    url: 'https://arxiv.org/abs/2401.03407',
    note: 'The model CutOut uses. Architecture, losses and training described in sections 3–4.',
  },
  {
    id: 'birefnet-weights',
    authors: 'P. Zheng',
    title: 'BiRefNet model card and weights (MIT licence)',
    where: 'Hugging Face, ZhengPeng7/BiRefNet',
    year: '2024',
    url: 'https://huggingface.co/ZhengPeng7/BiRefNet',
    note: 'Source of the weights. CutOut pins the 28 July 2024 release.',
  },
  {
    id: 'birefnet-code',
    authors: 'P. Zheng',
    title: 'BiRefNet reference implementation',
    where: 'GitHub, ZhengPeng7/BiRefNet',
    year: '2024',
    url: 'https://github.com/ZhengPeng7/BiRefNet',
  },
  {
    id: 'swin',
    authors: 'Z. Liu, Y. Lin, Y. Cao, H. Hu, Y. Wei, Z. Zhang, S. Lin, B. Guo',
    title: 'Swin Transformer: Hierarchical Vision Transformer using Shifted Windows',
    where: 'ICCV',
    year: '2021',
    url: 'https://arxiv.org/abs/2103.14030',
    note: 'The encoder (backbone) of BiRefNet; the general model uses the Large variant.',
  },
  {
    id: 'dcn',
    authors: 'X. Zhu, H. Hu, S. Lin, J. Dai',
    title: 'Deformable ConvNets v2: More Deformable, Better Results',
    where: 'CVPR',
    year: '2019',
    url: 'https://arxiv.org/abs/1811.11168',
    note: 'The modulated deformable convolution used in BiRefNet’s reconstruction blocks.',
  },
  {
    id: 'dis',
    authors: 'X. Qin, H. Dai, X. Hu, D.-P. Fan, L. Shao, L. Van Gool',
    title: 'Highly Accurate Dichotomous Image Segmentation',
    where: 'ECCV',
    year: '2022',
    url: 'https://arxiv.org/abs/2203.03041',
    note: 'Defines the dichotomous image segmentation task and the DIS5K dataset.',
  },
  {
    id: 'porterduff',
    authors: 'T. Porter, T. Duff',
    title: 'Compositing Digital Images',
    where: 'SIGGRAPH ’84, Computer Graphics 18(3), 253–259',
    year: '1984',
    url: 'https://doi.org/10.1145/800031.808606',
    note: 'Premultiplied alpha and the “over” operator.',
  },
  {
    id: 'smithblinn',
    authors: 'A. R. Smith, J. F. Blinn',
    title: 'Blue Screen Matting',
    where: 'SIGGRAPH ’96',
    year: '1996',
    url: 'https://doi.org/10.1145/237170.237263',
    note: 'Why recovering F, B and α from a single image is underdetermined.',
  },
  {
    id: 'guided',
    authors: 'K. He, J. Sun, X. Tang',
    title: 'Guided Image Filtering',
    where: 'IEEE TPAMI 35(6), 1397–1409',
    year: '2013',
    url: 'https://doi.org/10.1109/TPAMI.2012.213',
    note: 'The edge-aware filter CutOut uses to refine the matte (colour version, section 3.5).',
  },
  {
    id: 'forte',
    authors: 'M. Forte',
    title: 'Approximate Fast Foreground Colour Estimation',
    where: 'IEEE ICIP',
    year: '2021',
    url: 'https://doi.org/10.1109/ICIP42928.2021.9506164',
    note: 'The “blur-fusion” estimate behind Refine Edges ▸ Decontaminate.',
  },
  {
    id: 'keys',
    authors: 'R. Keys',
    title: 'Cubic Convolution Interpolation for Digital Image Processing',
    where: 'IEEE Trans. ASSP 29(6), 1153–1160',
    year: '1981',
    url: 'https://doi.org/10.1109/TASSP.1981.1163711',
    note: 'The cubic kernel (a = −½, the Catmull–Rom spline) used to upscale the prediction.',
  },
  {
    id: 'ciede2000',
    authors: 'G. Sharma, W. Wu, E. N. Dalal',
    title: 'The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations',
    where: 'Color Research & Application 30(1), 21–30',
    year: '2005',
    url: 'https://doi.org/10.1002/col.20070',
    note: 'The colour distance behind Magic Wand, Magic Eraser and Quick Selection.',
  },
  {
    id: 'ieee754',
    authors: 'IEEE',
    title: 'IEEE Standard for Floating-Point Arithmetic (IEEE 754-2019)',
    where: 'IEEE Std 754-2019',
    year: '2019',
    url: 'https://doi.org/10.1109/IEEESTD.2019.8766229',
    note: 'binary32 (FP32) and binary16 (FP16).',
  },
  {
    id: 'ort-ep',
    authors: 'ONNX Runtime',
    title: 'Execution Providers',
    where: 'onnxruntime.ai documentation',
    year: '2026',
    url: 'https://onnxruntime.ai/docs/execution-providers/',
  },
  {
    id: 'ort-dml',
    authors: 'ONNX Runtime',
    title: 'DirectML Execution Provider',
    where: 'onnxruntime.ai documentation',
    year: '2026',
    url: 'https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html',
    note: 'Requires sequential execution and no memory pattern, which CutOut sets.',
  },
  {
    id: 'coreml',
    authors: 'Apple',
    title: 'Core ML',
    where: 'Apple Developer documentation',
    year: '2026',
    url: 'https://developer.apple.com/documentation/coreml',
  },
  {
    id: 'mlcomputeunits',
    authors: 'Apple',
    title: 'MLComputeUnits.cpuAndGPU',
    where: 'Apple Developer documentation',
    year: '2026',
    url: 'https://developer.apple.com/documentation/coreml/mlcomputeunits/cpuandgpu',
  },
  {
    id: 'vision',
    authors: 'Apple',
    title: 'VNGenerateForegroundInstanceMaskRequest',
    where: 'Apple Developer documentation',
    year: '2026',
    url: 'https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest',
    note: 'The system subject-lifting model behind Fast mode on macOS.',
  },
];

export const refNumber = (id: string) => {
  const i = refs.findIndex((r) => r.id === id);
  if (i < 0) throw new Error(`unknown reference ${id}`);
  return i + 1;
};

/** Facts about the model and pipeline, each verified in the engine source (kind: app). */
export const pipeline = {
  inputSize: 1024,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  flattenGrey: 128,
  refineEps: 1e-4,
  workingMegapixels: 2.5,
  bandLow: 4,
  bandHigh: 251,
  brushSpacing: 0.2,
};

/** File sizes of the pinned model files, in bytes (from the SHA-256-verified downloads). */
export const modelFiles = {
  onnxFp32: 972_666_916,
  onnxFp16: 489_666_272,
  liteFp32: 224_005_088,
  coremlWeights: 463_618_272,
  safetensors: 884_878_856,
};

export const benchMachine = 'Apple M1 (4 performance + 4 efficiency cores), 16 GB, macOS 27.0.1';

/**
 * Measured end-to-end and inference-only figures for the two macOS back ends, from the
 * application's performance record (3–4 November 2026, two independent runs on 10 images, 1024²
 * network input). Ranges cover both runs. Inference and end-to-end figures are kept separate.
 */
export const backends = [
  {
    id: 'coreml',
    name: 'Core ML',
    detail: 'FP16 ML Program · CPU + GPU',
    inference: [1.93, 2.5] as [number, number],
    total8mp: [2.0, 2.85] as [number, number],
    total36mp: [3.5, 3.95] as [number, number],
    peakRssGb: [1.9, 2.0] as [number, number],
    firstLoad: '≈ 18 s once (verify + compile), then 0.7 s',
  },
  {
    id: 'onnx',
    name: 'ONNX Runtime',
    detail: 'FP32 · CPU, 8 threads',
    inference: [12.7, 15.5] as [number, number],
    total8mp: [12.9, 15.2] as [number, number],
    total36mp: [16.4, 17.0] as [number, number],
    peakRssGb: [9.2, 9.8] as [number, number],
    firstLoad: '≈ 2.7 s load + ≈ 13 s warm-up',
  },
];

/**
 * Re-run for this page on 8 November 2026 on the same machine: `cutout-cli bench` with the ONNX
 * FP32 model on the CPU, refinement on and off. Ground truth exists only for the synthetic scenes.
 * Identical to the application's published results to four decimals.
 */
export const groundTruth = [
  { id: 'strands', name: 'Fine 1–3 px strands', refined: { iou: 0.992, mae: 0.0119, edge: 0.0612 }, raw: { iou: 0.9564, mae: 0.014, edge: 0.0718 } },
  { id: 'disc', name: '45 % translucent disc', refined: { iou: 0.1047, mae: 0.1557, edge: 0.4814 }, raw: { iou: 0.1046, mae: 0.1558, edge: 0.4815 } },
];
