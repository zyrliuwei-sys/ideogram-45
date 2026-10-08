import { useState } from 'react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { Reveal } from '@/components/reveal';

/** Feature switcher: pick a habit on the left, see it on the right. */
export function Features() {
  const items = [
    {
      title: m['landing.features.f1_title'](),
      desc: m['landing.features.f1_desc'](),
      src: '/imgs/studio/variants.webp',
      width: 1152,
      height: 864,
    },
    {
      title: m['landing.features.f2_title'](),
      desc: m['landing.features.f2_desc'](),
      src: '/imgs/studio/show-poster.webp',
      width: 864,
      height: 1152,
    },
    {
      title: m['landing.features.f3_title'](),
      desc: m['landing.features.f3_desc'](),
      src: '/imgs/studio/feature-refs.webp',
      width: 1152,
      height: 864,
    },
  ];
  const [active, setActive] = useState(0);

  return (
    <section id="features" className="px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold sm:text-[2.75rem] sm:leading-[1.05]">
            {m['landing.features.title']()}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            {m['landing.features.subtitle']()}
          </p>
        </Reveal>
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-2" role="tablist">
            {items.map((item, i) => (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={cn(
                  'rounded-2xl border p-5 text-left transition-colors',
                  active === i
                    ? 'panel border-white/15'
                    : 'border-transparent hover:bg-white/[0.03]'
                )}
              >
                <span
                  className={cn(
                    'font-display block text-xl font-bold sm:text-2xl',
                    active !== i && 'text-foreground/55'
                  )}
                >
                  {item.title}
                </span>
                <span
                  className={cn(
                    'grid transition-[grid-template-rows] duration-300',
                    active === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <span className="text-muted-foreground overflow-hidden pt-0 leading-relaxed">
                    <span className="block pt-3">{item.desc}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="proof self-start">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
              {items.map((item, i) => (
                <img
                  key={item.src}
                  src={item.src}
                  alt={item.title}
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  className={cn(
                    'absolute inset-0 size-full object-cover transition-opacity duration-500',
                    active === i ? 'opacity-100' : 'opacity-0'
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
