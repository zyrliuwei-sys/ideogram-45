import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { CTA } from '@/blocks/cta';
import { FAQ, faqItems } from '@/blocks/faq';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { Pricing } from '@/blocks/pricing';

export const Route = createFileRoute('/pricing')({
  loader: () => {
    const locale = getLocale();
    return {
      locale,
      title: `${m['landing.pricing.page_title']({}, { locale })} | Ideogram 4.5`,
      description: m['landing.pricing.page_intro']({}, { locale }),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/pricing`, { locale: loc as any }).href;
    return {
      meta: [
        { title: loaderData.title },
        { name: 'description', content: loaderData.description },
        { property: 'og:title', content: loaderData.title },
        { property: 'og:description', content: loaderData.description },
      ],
      links: [
        { rel: 'canonical', href: urlFor(loaderData.locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
      ],
    };
  },
  component: PricingPage,
});

function PricingPage() {
  const all = faqItems();
  // Billing-related questions only: tiers, failures, where results go.
  const billing = [all[4], all[5], all[6], all[7]];

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="px-4 pt-16 pb-12 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="readout text-primary text-xs tracking-[0.14em] uppercase">
              {m['landing.pricing.page_eyebrow']()}
            </p>
            <h1 className="mt-4 text-[2.25rem] leading-[1.05] font-bold text-balance sm:text-[3.25rem]">
              {m['landing.pricing.page_title']()}
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed">
              {m['landing.pricing.page_intro']()}
            </p>
          </div>
        </section>
        <Pricing variant="page" />
        <FAQ title={m['landing.pricing.page_faq']()} items={billing} />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
