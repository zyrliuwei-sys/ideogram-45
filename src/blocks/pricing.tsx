import { lazy, Suspense, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  LifeBuoy,
  Lock,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import {
  CENTS_PER_CREDIT,
  DEFAULT_TIER_CREDITS,
  type IdeogramTier,
} from '@/config/ideogram';
import { pricingCatalog } from '@/config/pricing';
import { apiGet, apiPost } from '@/lib/api-client';
import { currentPathWithQuery } from '@/lib/redirect';
import { flushStudioDraft } from '@/lib/studio-draft';
import { track } from '@/lib/track';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { usePublicConfig } from '@/hooks/use-public-config';
import type { PaymentProvider } from '@/components/payment-provider-modal';
import {
  PricingTable,
  type PricingFeature,
  type PricingGroup,
  type PricingPlan,
} from '@/components/pricing-table';

const PaymentProviderModal = lazy(() =>
  import('@/components/payment-provider-modal').then((mod) => ({
    default: mod.PaymentProviderModal,
  }))
);

// $9.9 rather than $9.90; whole dollars stay $23.
function usd(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const ALL_PROVIDERS: PaymentProvider[] = [
  'stripe',
  'creem',
  'waffo',
  'paypal',
  'alipay',
  'wechat',
];

export function Pricing({
  title,
  variant = 'section',
}: {
  title?: string;
  /**
   * `dialog` drops the page-section chrome for use inside a modal; `page`
   * drops the heading (the /pricing route renders its own h1).
   */
  variant?: 'section' | 'dialog' | 'page';
} = {}) {
  const router = useRouter();
  const { data: session } = useSession();

  const { data: configsData, refetch: refetchConfigs } = usePublicConfig();
  const configs = configsData ?? {};
  const [modalOpen, setModalOpen] = useState(false);
  // The provider picker (a dialog) loads on first open and stays mounted.
  const [modalMounted, setModalMounted] = useState(false);
  if (modalOpen && !modalMounted) setModalMounted(true);
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [loadingProvider, setLoadingProvider] =
    useState<PaymentProvider | null>(null);

  const enabledProviders = useMemo<PaymentProvider[]>(
    () => ALL_PROVIDERS.filter((p) => configs[`${p}_enabled`] === 'true'),
    [configs]
  );

  // Live per-image price so "≈ N images" matches what generation charges.
  const { data: priceData } = useQuery({
    queryKey: ['image-price'],
    queryFn: () => apiGet<Record<IdeogramTier, number>>('/api/image/price'),
    staleTime: 10 * 60_000,
  });
  const perImage = priceData?.standard ?? DEFAULT_TIER_CREDITS.standard;
  const perHigh = priceData?.high ?? DEFAULT_TIER_CREDITS.high;

  function features(credits: number, extra: PricingFeature[]) {
    return [
      {
        icon: Sparkles,
        label: m['landing.pricing.feature_credits']({
          credits: credits.toLocaleString('en-US'),
        }),
      },
      {
        icon: ImageIcon,
        label: m['landing.pricing.feature_images']({
          standard: Math.floor(credits / perImage).toLocaleString('en-US'),
          high: Math.floor(credits / perHigh).toLocaleString('en-US'),
        }),
      },
      { icon: Lock, label: m['landing.pricing.feature_lock']() },
      { icon: RotateCcw, label: m['landing.pricing.feature_refund']() },
      ...extra,
    ];
  }

  // Display data comes from the same catalog the checkout API trusts.
  function plan(
    productId: string,
    opts: {
      name: string;
      description: string;
      featured?: boolean;
      badge?: string;
      highlight?: string;
      plainFrame?: boolean;
      extra?: PricingFeature[];
      originalPrice?: string;
    }
  ): PricingPlan {
    const product = pricingCatalog[productId];
    const interval = product.plan?.interval;
    // Credits beyond the base rate (1 credit per CENTS_PER_CREDIT paid).
    const bonus = Math.round(
      (product.credits * CENTS_PER_CREDIT * 100) / product.priceInCents - 100
    );
    // Yearly plans are shown as their monthly equivalent, billed yearly.
    const yearly = interval === 'year';
    const card: PricingPlan = {
      id: productId,
      name: opts.name,
      description: yearly
        ? `${opts.description} · ${m['landing.pricing.billed_yearly']({ price: usd(product.priceInCents) })}`
        : opts.description,
      price: usd(
        yearly ? Math.round(product.priceInCents / 12) : product.priceInCents
      ),
      originalPrice: opts.originalPrice,
      interval: interval ? m['landing.pricing.per_month']() : undefined,
      featured: opts.featured,
      badge: opts.badge,
      plainFrame: opts.plainFrame ?? true,
      highlight:
        opts.highlight ??
        (bonus > 0
          ? m['landing.pricing.bonus']({ percent: bonus })
          : undefined),
      features: features(product.credits, opts.extra ?? []),
      productId,
      priceInCents: product.priceInCents,
      currency: product.currency,
      credits: product.credits,
      plan: product.plan,
      buttonText: product.plan ? undefined : m['landing.pricing.buy_now'](),
    };
    return card;
  }

  const packExtra = [
    {
      icon: InfinityIcon,
      label: m['landing.pricing.feature_no_subscription'](),
    },
  ];
  const monthlyExtra = [
    {
      icon: CalendarClock,
      label: m['landing.pricing.feature_monthly_refill'](),
    },
    { icon: XCircle, label: m['landing.pricing.feature_cancel']() },
  ];
  const tiers = [
    [
      'creator',
      m['landing.pricing.creator'](),
      m['landing.pricing.creator_desc'](),
    ],
    [
      'studio',
      m['landing.pricing.studio'](),
      m['landing.pricing.studio_desc'](),
    ],
    ['max', m['landing.pricing.max'](), m['landing.pricing.max_desc']()],
  ] as const;
  const packs = [
    ['pack_small', m['landing.pricing.pack_small']()],
    ['pack_medium', m['landing.pricing.pack_medium']()],
    ['pack_large', m['landing.pricing.pack_large']()],
  ] as const;

  const groups: PricingGroup[] = [
    {
      key: 'monthly',
      label: m['landing.pricing.monthly'](),
      plans: tiers.map(([tier, name, description]) =>
        plan(`${tier}_monthly`, {
          name,
          description,
          featured: tier === 'creator',
          badge:
            tier === 'creator' ? m['landing.pricing.popular']() : undefined,
          extra:
            tier === 'creator'
              ? monthlyExtra
              : [
                  ...monthlyExtra,
                  {
                    icon: LifeBuoy,
                    label: m['landing.pricing.feature_support'](),
                  },
                ],
        })
      ),
    },
    {
      key: 'one-time',
      label: m['landing.pricing.one_time'](),
      plans: packs.map(([id, name]) =>
        plan(id, {
          name,
          description: m['landing.pricing.pack_desc'](),
          featured: id === 'pack_medium',
          badge:
            id === 'pack_medium' ? m['landing.pricing.popular']() : undefined,
          extra: packExtra,
        })
      ),
    },
  ];

  const checkoutMutation = useMutation({
    mutationFn: ({
      plan,
      provider,
    }: {
      plan: PricingPlan;
      provider?: PaymentProvider;
    }) =>
      apiPost<{ checkout_url?: string }>('/api/payment/checkout', {
        product_id: plan.productId,
        product_name: plan.productName || plan.name,
        plan_name: plan.plan?.name || plan.name,
        price: plan.priceInCents,
        currency: plan.currency || 'usd',
        type: plan.plan ? 'subscription' : 'one-time',
        description: plan.name,
        plan: plan.plan,
        credits: plan.credits,
        credits_valid_days: plan.creditsValidDays,
        payment_provider: provider,
        // Come back to the page the user paid from.
        redirect: currentPathWithQuery('/settings/billing'),
      }),
    onSuccess: async (data) => {
      if (!data?.checkout_url) {
        toast.error('Checkout failed');
        setLoadingProvider(null);
        return;
      }
      try {
        await flushStudioDraft();
      } catch (error) {
        toast.error((error as Error).message);
        setLoadingProvider(null);
        return;
      }
      window.location.href = data.checkout_url;
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Checkout failed');
      setLoadingProvider(null);
    },
  });

  function startCheckout(plan: PricingPlan, provider?: PaymentProvider) {
    track('begin_checkout', {
      plan: plan.productId ?? '',
      value: (plan.priceInCents ?? 0) / 100,
    });
    setLoadingProvider(provider ?? null);
    checkoutMutation.mutate({ plan, provider });
  }

  async function handleCheckout(plan: PricingPlan) {
    if (!session?.user) {
      try {
        await flushStudioDraft();
      } catch (error) {
        return toast.error((error as Error).message);
      }
      const callbackUrl = encodeURIComponent(currentPathWithQuery('/pricing'));
      router.push(`/sign-in?callbackUrl=${callbackUrl}`);
      return;
    }

    // A click can land before public config has loaded — fetch it first
    // instead of guessing a provider that may not be configured.
    const cfg = configsData ?? (await refetchConfigs()).data ?? {};
    const enabled = ALL_PROVIDERS.filter((p) => cfg[`${p}_enabled`] === 'true');
    const selectEnabled = cfg.select_payment_enabled === 'true';
    // Unknown → omit it; the server falls back to the admin default provider.
    const defaultProvider = (cfg.default_payment_provider || enabled[0]) as
      | PaymentProvider
      | undefined;

    if (selectEnabled && enabled.length > 1) {
      setPendingPlan(plan);
      setModalOpen(true);
      return;
    }

    await startCheckout(plan, defaultProvider);
  }

  function handleProviderSelect(provider: PaymentProvider) {
    if (!pendingPlan) return;
    startCheckout(pendingPlan, provider);
  }

  const dialog = variant === 'dialog';
  const Wrapper = dialog ? 'div' : 'section';

  return (
    <Wrapper
      id={dialog ? undefined : 'pricing'}
      className={
        dialog
          ? undefined
          : variant === 'page'
            ? 'px-4 pb-20'
            : 'scroll-mt-20 px-4 py-24 sm:py-28'
      }
    >
      <div className="mx-auto max-w-6xl">
        <div
          className={cn(
            dialog ? 'mb-8 pr-8 text-center' : 'mb-14 text-center',
            variant === 'page' && 'hidden'
          )}
        >
          <h2
            className={
              dialog
                ? 'text-2xl font-bold tracking-tight sm:text-3xl'
                : 'text-3xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.05]'
            }
          >
            {title ?? m['landing.pricing.title']()}
          </h2>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg">
            {m['landing.pricing.description']()}
          </p>
        </div>
        {/* Stays visible on /pricing, where the heading above is hidden. */}
        <p
          className={cn(
            'readout text-primary text-center text-xs',
            dialog
              ? '-mt-5 mb-8'
              : variant === 'page'
                ? 'mb-10'
                : '-mt-11 mb-14'
          )}
        >
          {m['landing.pricing.per_image']({
            standard: perImage,
            high: perHigh,
          })}
        </p>
        <PricingTable
          groups={groups}
          defaultGroup={variant === 'dialog' ? 'one-time' : 'monthly'}
          onCheckout={handleCheckout}
        />
      </div>

      {modalMounted && (
        <Suspense fallback={null}>
          <PaymentProviderModal
            open={modalOpen}
            onOpenChange={(open) => {
              setModalOpen(open);
              if (!open) {
                setPendingPlan(null);
                setLoadingProvider(null);
              }
            }}
            providers={enabledProviders.length ? enabledProviders : ['stripe']}
            loadingProvider={loadingProvider}
            onSelect={handleProviderSelect}
            planName={pendingPlan?.name}
            price={pendingPlan?.price}
          />
        </Suspense>
      )}
    </Wrapper>
  );
}
