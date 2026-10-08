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
 * Ideogram 4.5 catalog. An image costs 2 credits (Ideogram 4.5) or 6 credits
 * (Ideogram 4.5 High) — see ./ideogram.ts.
 *
 * Pricing floor: credits never sell below ~$0.22 each, so the priciest image
 * (High, ≤ $0.22 at fal) still clears 6× its cost. Check
 * priceInCents / credits before adding a product.
 * Keys MUST match what the pricing UI sends as product_id.
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
    credits: 40,
  },
  pack_medium: {
    productId: 'pack_medium',
    productName: 'Medium Pack',
    planName: 'Medium Pack',
    description: 'Medium Pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 2490,
    currency: 'usd',
    credits: 100,
  },
  pack_large: {
    productId: 'pack_large',
    productName: 'Large Pack',
    planName: 'Large Pack',
    description: 'Large Pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 5900,
    currency: 'usd',
    credits: 250,
  },
  creator_monthly: {
    productId: 'creator_monthly',
    productName: 'Creator',
    planName: 'Creator Monthly',
    description: 'Creator Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 2900,
    currency: 'usd',
    credits: 120,
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
    priceInCents: 7900,
    currency: 'usd',
    credits: 330,
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
    priceInCents: 15800,
    currency: 'usd',
    credits: 660,
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
