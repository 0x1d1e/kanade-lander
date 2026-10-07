export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
export const smooth = (progress: number) => {
  const p = clamp(progress);
  return p * p * (3 - 2 * p);
};
export type Geometry = { width: number; height: number; radius: number };
export const heroSteps = [
  { at: 0, width: 116, height: 40, radius: 24, label: 'REST' },
  { at: 0.24, width: 260, height: 52, radius: 28, label: 'COMPACT' },
  { at: 0.44, width: 330, height: 94, radius: 28, label: 'PEEK' },
  { at: 0.7, width: 440, height: 310, radius: 30, label: 'EXPANDED' },
  { at: 1, width: 390, height: 58, radius: 30, label: 'SPLIT' },
] as const;
export function heroGeometry(progress: number): Geometry {
  const p = clamp(progress);
  const index = heroSteps.findIndex(
    (step, i) => i < heroSteps.length - 1 && p <= heroSteps[i + 1].at && p >= step.at,
  );
  const from = heroSteps[index < 0 ? 3 : index];
  const to = heroSteps[index < 0 ? 4 : index + 1];
  const t = smooth((p - from.at) / (to.at - from.at));
  return {
    width: mix(from.width, to.width, t),
    height: mix(from.height, to.height, t),
    radius: mix(from.radius, to.radius, t),
  };
}
export function blendGeometry(from: Geometry, to: Geometry, progress: number): Geometry {
  return {
    width: mix(from.width, to.width, progress),
    height: mix(from.height, to.height, progress),
    radius: mix(from.radius, to.radius, progress),
  };
}
