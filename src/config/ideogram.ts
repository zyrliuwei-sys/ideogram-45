/**
 * Ideogram 4.5 studio options (client-safe, no server imports).
 *
 * The generator offers two quality tiers and a fixed set of aspect ratios.
 * Credit prices default to the values below and can be overridden in
 * admin → Settings → AI → Ideogram 4.5 studio.
 *
 * Cost basis (fal list prices, 2026-10): Ideogram V3 Balanced ≈ $0.06,
 * Quality ≈ $0.09, GPT Image 2 edit (high) ≤ $0.22 per image. Credits sell at
 * ≈ $0.24 (see ./pricing.ts), so 2 / 6 credits keep a healthy margin.
 */

export const IDEOGRAM_TIERS = ['standard', 'high'] as const;
export type IdeogramTier = (typeof IDEOGRAM_TIERS)[number];

export const DEFAULT_TIER_CREDITS: Record<IdeogramTier, number> = {
  standard: 2,
  high: 6,
};

export function isIdeogramTier(value: unknown): value is IdeogramTier {
  return value === 'standard' || value === 'high';
}

export function resolveTierCredits(
  configs: Record<string, string>,
  tier: IdeogramTier
) {
  const override = Number(configs[`ideogram_credits_${tier}`]);
  if (Number.isFinite(override) && override > 0) return Math.ceil(override);
  return DEFAULT_TIER_CREDITS[tier];
}

/** Aspect ratios → fal `image_size` (enum where one exists, else explicit). */
export const ASPECT_RATIOS = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '3:2': { width: 1536, height: 1024 },
  '2:3': { width: 1024, height: 1536 },
} as const;
export type AspectRatio = keyof typeof ASPECT_RATIOS;
export const DEFAULT_ASPECT: AspectRatio = '1:1';

export function isAspectRatio(value: unknown): value is AspectRatio {
  return typeof value === 'string' && value in ASPECT_RATIOS;
}

export const MAX_PROMPT_CHARS = 5000;

/** Default fal endpoints; admin settings override them. */
export const DEFAULT_ENDPOINTS = {
  generate: 'fal-ai/ideogram/v3',
  maskEdit: 'fal-ai/ideogram/v3/edit',
  edit: 'openai/gpt-image-2/edit',
};
