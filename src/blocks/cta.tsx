import { ArrowRight } from 'lucide-react';

import { m } from '@/paraglide/messages.js';
import { Reveal } from '@/components/reveal';

export function CTA() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-24 sm:py-32">
      <img
        src="/imgs/studio/hero-bg.webp"
        width={1312}
        height={736}
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-10 size-full object-cover opacity-30 saturate-[0.85]"
      />
      <div className="from-background via-background/85 to-background/40 absolute inset-0 -z-10 bg-gradient-to-r" />
      <Reveal className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <h2 className="text-3xl leading-[1.05] font-bold sm:text-[2.75rem]">
            {m['landing.cta.title']()}
          </h2>
          <p className="text-foreground/75 mt-5 text-lg leading-relaxed">
            {m['landing.cta.description']()}
          </p>
          <a
            href="/#create"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold whitespace-nowrap"
          >
            {m['landing.cta.button']()}
            <ArrowRight className="size-4" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
