import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { CTA } from '@/blocks/cta';
import { DriftDemo } from '@/blocks/drift-demo';
import { FAQ, faqItems } from '@/blocks/faq';
import { Features } from '@/blocks/features';
import { Footer } from '@/blocks/footer';
import { Guide } from '@/blocks/guide';
import { Header } from '@/blocks/header';
import { Hero, HERO_IMAGE } from '@/blocks/hero';
import { HowItWorks } from '@/blocks/how-it-works';
import { Pricing } from '@/blocks/pricing';
import { Showcase } from '@/blocks/showcase';
import { StudioSection } from '@/blocks/studio-section';
import { Why } from '@/blocks/why';

function HomePage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <StudioSection />
        <Showcase />
        <DriftDemo />
        <Features />
        <Why />
        <HowItWorks />
        <Guide />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/')({
  loader: () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = (loaderData?.locale ?? 'en') as any;
    const title = m['common.metadata.title']({}, { locale });
    const description = m['common.metadata.description']({}, { locale });
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    const image = `${envConfigs.app_url}${HERO_IMAGE}`;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: image },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [
        {
          rel: 'preload',
          as: 'image',
          href: HERO_IMAGE,
          fetchPriority: 'high',
        },
        { rel: 'canonical', href: urlFor(locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebApplication',
                name: envConfigs.app_name,
                url: urlFor(locale),
                description,
                applicationCategory: 'DesignApplication',
                operatingSystem: 'Web',
                inLanguage: locale,
                image,
              },
              {
                '@type': 'FAQPage',
                mainEntity: faqItems().map(([q, a]) => ({
                  '@type': 'Question',
                  name: q,
                  acceptedAnswer: { '@type': 'Answer', text: a },
                })),
              },
            ],
          }),
        },
      ],
    };
  },
  component: HomePage,
});
