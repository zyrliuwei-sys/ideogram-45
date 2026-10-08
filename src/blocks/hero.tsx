import { ArrowRight } from 'lucide-react';

import { m } from '@/paraglide/messages.js';
import { BeforeAfter } from '@/components/before-after';

export const HERO_IMAGE = '/imgs/studio/hero-after.webp';

export function Hero() {
  return (
    <section className="px-4 pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <div>
          <p className="readout text-primary text-xs tracking-[0.14em] uppercase">
            {m['landing.hero.eyebrow']()}
          </p>
          <h1 className="mt-5 text-[2.4rem] leading-[1.04] font-bold text-balance sm:text-[3.05rem]">
            {m['landing.hero.title_a']()}{' '}
            <span className="text-foreground/55">
              {m['landing.hero.title_b']()}
            </span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
            {m['landing.hero.subtitle']()}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#create"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold whitespace-nowrap"
            >
              {m['landing.hero.cta_primary']()}
              <ArrowRight className="size-4" />
            </a>
            <a
              href="#drift"
              className="text-foreground/85 hover:text-foreground inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-medium whitespace-nowrap hover:border-white/30"
            >
              {m['landing.hero.cta_secondary']()}
            </a>
          </div>
        </div>

        <div className="proof">
          <BeforeAfter
            before="/imgs/studio/hero-before.webp"
            after={HERO_IMAGE}
            beforeLabel={m['landing.hero.before']()}
            afterLabel={m['landing.hero.after']()}
            ariaLabel={m['landing.hero.drag']()}
            width={1400}
            height={1050}
            priority
            className="border border-white/10"
          />
        </div>
      </div>
    </section>
  );
}
