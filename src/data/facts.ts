// Every product claim on the site comes from here, with its evidence. Sources are files in the
// application repository (ca-works/cutout, branch dev/v0.1, commit 907c359, 4 November 2026):
// README.md, docs/TESTING.md, docs/ARCHITECTURE.md, docs/BUILDING.md, docs/PERFORMANCE.md.
// Change a number only together with new measurements there.

export const appVersion = '0.1';

export const requirements = {
  os: 'macOS 14 Sonoma or later',
  chip: 'Apple silicon (M-series) Mac',
  signing: 'Ad-hoc signed, not notarized by Apple',
  // BUILDING.md: full build — app 477 MB, DMG 403 MB (Core ML model included).
  fullBuild: 'about 400 MB download, model included',
};

/** Measured on the reference machine; see testMachine. TESTING.md §2. */
export const measured = {
  launchMs: 535, // median of 561, 521, 526, 535, 536 ms (standard build, launch → main window)
  bestSeconds: 2.5, // Best Quality, BiRefNet on Core ML (GPU), model cached; first run incl. load 4.5 s
  firstBestSeconds: 4.5,
  fastSeconds: 0.6, // Fast mode, Apple Vision
  idleMemoryMB: 125,
};

export const testMachine = 'Apple M1, 16 GB memory, macOS 27.0.1, CutOut 0.1 development build, tested 3–4 November 2026';

export const shortcuts: [string, string][] = [
  ['⌘V', 'Paste (a second paste adds a layer)'],
  ['⌘B', 'Remove background — Best Quality'],
  ['⇧⌘B', 'Remove background — Fast'],
  ['⌘C', 'Copy'],
  ['⇧⌘C', 'Copy & Clear'],
  ['⌥⌘C', 'Copy & Close'],
  ['\\', 'Compare before / after'],
  ['⌘Z / ⇧⌘Z', 'Undo / Redo'],
  ['⌘S', 'Save project (.cutout)'],
  ['⇧⌘E', 'Export PNG'],
  ['⌥⌘T', 'Show or hide the tools sidebar'],
  ['⌥⌘L', 'Show or hide the layers inspector'],
  ['[ and ]', 'Brush size'],
  ['⌘0 / ⌘1', 'Fit / Actual size'],
];

export const toolShortcuts: [string, string][] = [
  ['V', 'Move'],
  ['M', 'Rectangle selection'],
  ['O', 'Ellipse selection'],
  ['L', 'Lasso'],
  ['P', 'Polygon lasso'],
  ['W', 'Magic Wand'],
  ['Q', 'Quick Selection'],
  ['E', 'Magic Eraser'],
  ['X', 'Eraser'],
  ['R', 'Restore'],
  ['B', 'Brush'],
  ['G', 'Paint bucket'],
  ['I', 'Eyedropper'],
  ['T', 'Text'],
  ['U', 'Shapes'],
  ['C', 'Crop'],
  ['H or Space', 'Hand'],
  ['Z', 'Zoom'],
];

/** The capability index. Only features implemented and tested in v0.1 (README "Highlights"). */
export const capabilities: { id: string; name: string; line: string; items: string[] }[] = [
  {
    id: 'remove',
    name: 'Remove',
    line: 'Two ways to lift the subject, both on your Mac.',
    items: [
      'Best Quality: BiRefNet on Core ML, upscaled to full resolution with an edge-aware guided filter',
      'Fast: Apple Vision, built into macOS',
      'Removal writes a mask, never deletes pixels',
      'Restore brush and Restore All bring anything back',
    ],
  },
  {
    id: 'refine',
    name: 'Refine',
    line: 'Edges that hold up when you zoom in.',
    items: [
      'Refine Edges: radius, smooth, feather, contrast, shift edge',
      'Colour decontamination removes background fringes',
      'Before/after compare with one key',
    ],
  },
  {
    id: 'select',
    name: 'Select',
    line: 'Every selection tool you reach for, and the modifiers you expect.',
    items: [
      'Rectangle, ellipse, lasso, polygon',
      'Magic Wand and Quick Selection',
      'Add, subtract, intersect',
      'Feather, grow, shrink, smooth, invert',
    ],
  },
  {
    id: 'retouch',
    name: 'Retouch',
    line: 'Colour tools that measure colour the way people see it.',
    items: [
      'Magic Eraser and Magic Wand use CIEDE2000 colour distance',
      'Contiguous or global; anti-aliased edges respected',
      'Brush, eraser, restore — size, hardness, opacity',
      'Paint bucket, eyedropper',
    ],
  },
  {
    id: 'layers',
    name: 'Layers',
    line: 'Paste again and it becomes a layer.',
    items: [
      'Thumbnails, visibility, opacity, reorder, rename',
      'Duplicate, delete, merge down, merge selected, flatten',
      'Move, scale and rotate with handles',
    ],
  },
  {
    id: 'create',
    name: 'Create',
    line: 'Add the label or the arrow without leaving the app.',
    items: ['Editable text layers', 'Shapes: rectangle, ellipse, line, arrow'],
  },
  {
    id: 'adjust',
    name: 'Canvas & adjust',
    line: 'The everyday fixes, in one place.',
    items: [
      'Crop, trim, resize, canvas size, rotate, flip',
      'Exposure, contrast, highlights and shadows',
      'Saturation, temperature, tint, hue, sharpen',
      'Invert, greyscale, auto levels',
    ],
  },
  {
    id: 'keep',
    name: 'Copy & keep',
    line: 'Get the result out — or keep it editable.',
    items: [
      'Copy puts a transparent PNG (and TIFF with alpha) on the clipboard',
      'Export PNG or JPEG',
      '.cutout projects keep layers, masks and text editable',
      'Undo and redo everything; File ▸ Restore Last Session',
    ],
  },
];
