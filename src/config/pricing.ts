/**
 * Authoritative pricing catalog.
 *
 * The checkout API uses this as the SOURCE OF TRUTH for price/credits/duration.
 * Any price, credits, or plan info sent by the client is IGNORED — only the
 * product_id is honored, and everything else is looked up here.
 *
 * To change pricing, edit this file and redeploy. Admin UI cannot alter prices.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  currency: string;
  credits: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
};

/**
 * Ideogram 4.5 catalog. 1 credit = $0.01 (fal's unit); an image costs 42
 * credits (Ideogram 4.5) or 154 credits (High) — 7× its fal cost, see
 * ./ideogram.ts.
 *
 * The smallest pack sells credits at exactly $0.01 (the full 7×); bigger
 * packs and monthly plans add bonus credits, but none sells below ~$0.009
 * per credit (≥ 6.3× fal cost). Check priceInCents / credits before adding
 * a product. Keys MUST match what the pricing UI sends as product_id.
 */
export const pricingCatalog: Record<string, PricingProduct> = {
  pack_small: {
    productId: 'pack_small',
    productName: 'Small Pack',
    planName: 'Small Pack',
    description: 'Small Pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 990,
    currency: 'usd',
    credits: 990,
  },
  pack_medium: {
    productId: 'pack_medium',
    productName: 'Medium Pack',
    planName: 'Medium Pack',
    description: 'Medium Pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 2490,
    currency: 'usd',
    credits: 2600,
  },
  pack_large: {
    productId: 'pack_large',
    productName: 'Large Pack',
    planName: 'Large Pack',
    description: 'Large Pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 5900,
    currency: 'usd',
    credits: 6300,
  },
  creator_monthly: {
    productId: 'creator_monthly',
    productName: 'Creator',
    planName: 'Creator Monthly',
    description: 'Creator Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 1900,
    currency: 'usd',
    credits: 2000,
    plan: {
      name: 'Creator',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
  studio_monthly: {
    productId: 'studio_monthly',
    productName: 'Studio',
    planName: 'Studio Monthly',
    description: 'Studio Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 4900,
    currency: 'usd',
    credits: 5300,
    plan: {
      name: 'Studio',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
  max_monthly: {
    productId: 'max_monthly',
    productName: 'Max',
    planName: 'Max Monthly',
    description: 'Max Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 9900,
    currency: 'usd',
    credits: 11000,
    plan: {
      name: 'Max',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}
