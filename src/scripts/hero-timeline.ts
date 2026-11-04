// The hero's choreography: one place that maps scroll progress (0–1) to scene parameters.
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Scroll ranges of the three captioned steps: trace, lift, remove. */
export const STEPS: [number, number][] = [
  [0.04, 0.36],
  [0.32, 0.52],
  [0.5, 0.95],
];

export interface Choreography {
  cut: number;
  lift: number;
  peel: number;
  lineAlpha: number;
  tilt: number;
}

export function choreograph(p: number): Choreography {
  return {
    cut: ease(span(p, ...STEPS[0])),
    lift: ease(span(p, ...STEPS[1])),
    peel: span(p, ...STEPS[2]),
    lineAlpha: 1 - span(p, 0.6, 0.74),
    tilt: 0.16 * ease(span(p, 0.3, 0.6)) - 0.12 * ease(span(p, 0.74, 1)),
  };
}
