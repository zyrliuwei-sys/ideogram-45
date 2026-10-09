/**
 * Ideogram 4.5 studio options (client-safe, no server imports).
 *
 * The generator offers two quality tiers and a fixed set of aspect ratios.
 * Credit prices default to the values below and can be overridden in
 * admin → Settings → AI → Ideogram 4.5 studio.
 *
 * Credit unit = fal's billing unit: 1 credit is $0.01 (one US cent), so an
 * image's credit price reads directly against its fal cost.
 */

export const IDEOGRAM_TIERS = ['standard', 'high'] as const;
export type IdeogramTier = (typeof IDEOGRAM_TIERS)[number];

/** USD cents per credit — packs in ./pricing.ts sell at about this rate. */
export const CENTS_PER_CREDIT = 1;

/**
 * fal list price per image in cents (2026-10, same for generate and edit):
 * Ideogram 4.5 quality "medium" $0.06, "high" $0.22.
 */
export const FAL_COST_CENTS: Record<IdeogramTier, number> = {
  standard: 6,
  high: 22,
};

/** Users pay 7× the fal cost. */
export const CREDIT_MARKUP = 7;

export const DEFAULT_TIER_CREDITS: Record<IdeogramTier, number> = {
  standard: (FAL_COST_CENTS.standard * CREDIT_MARKUP) / CENTS_PER_CREDIT, // 42
  high: (FAL_COST_CENTS.high * CREDIT_MARKUP) / CENTS_PER_CREDIT, // 154
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

/**
 * Aspect ratios → fal `image_size` (enum where one exists, else explicit).
 * Ideogram 4.5 only accepts its own list of explicit sizes (1248×832 is on
 * it, 1536×1024 is not).
 */
export const ASPECT_RATIOS = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '3:2': { width: 1248, height: 832 },
  '2:3': { width: 832, height: 1248 },
} as const;
export type AspectRatio = keyof typeof ASPECT_RATIOS;
export const DEFAULT_ASPECT: AspectRatio = '1:1';

export function isAspectRatio(value: unknown): value is AspectRatio {
  return typeof value === 'string' && value in ASPECT_RATIOS;
}

export const MAX_PROMPT_CHARS = 5000;

/** Default fal endpoints; admin settings override them. */
export const DEFAULT_ENDPOINTS = {
  generate: 'ideogram/v4.5',
  maskEdit: 'ideogram/v4.5/edit',
  edit: 'ideogram/v4.5/edit',
};

/** Mask color that marks the area to change. */
export type MaskEditColor = 'black' | 'white';

/**
 * Ideogram 4.5 edits BLACK; fal's V3 edit edits WHITE (despite its docs).
 * Both verified with real calls.
 */
export function maskEditColorFor(endpoint: string): MaskEditColor {
  return /ideogram\/v3/.test(endpoint) ? 'white' : 'black';
}
