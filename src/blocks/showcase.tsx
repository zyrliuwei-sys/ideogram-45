import { ArrowUpRight } from 'lucide-react';

import { EXAMPLE_PROMPTS, RANDOM_PROMPTS } from '@/config/studio-prompts';
import { sendPromptToStudio } from '@/lib/studio-events';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { Reveal } from '@/components/reveal';

const ITEMS = [
  {
    src: '/imgs/studio/show-poster.webp',
    w: 1152,
    h: 1536,
    label: () => m['landing.showcase.poster'](),
    prompt: EXAMPLE_PROMPTS[0],
    cell: 'md:col-span-5 md:row-span-2',
    ratio: 'aspect-[3/4] md:aspect-auto md:h-full',
  },
  {
    src: '/imgs/studio/show-sign.webp',
    w: 1400,
    h: 788,
    label: () => m['landing.showcase.sign'](),
    prompt: EXAMPLE_PROMPTS[2],
    cell: 'md:col-span-7',
    ratio: 'aspect-[16/9]',
  },
  {
    src: '/imgs/studio/show-label.webp',
    w: 1232,
    h: 1536,
    label: () => m['landing.showcase.label'](),
    prompt: EXAMPLE_PROMPTS[1],
    cell: 'md:col-span-3',
    ratio: 'aspect-[4/5]',
  },
  {
    src: '/imgs/studio/show-book.webp',
    w: 1232,
    h: 1536,
    label: () => m['landing.showcase.book'](),
    prompt: RANDOM_PROMPTS[3],
    cell: 'md:col-span-4',
    ratio: 'aspect-[4/5]',
  },
  {
    src: '/imgs/studio/show-interior.webp',
    w: 1400,
    h: 788,
    label: () => m['landing.showcase.interior'](),
    prompt: RANDOM_PROMPTS[5],
    cell: 'md:col-span-7',
    ratio: 'aspect-[16/9]',
  },
  {
    src: '/imgs/studio/show-watch.webp',
    w: 1400,
    h: 788,
    label: () => m['landing.showcase.sneaker'](),
    prompt: RANDOM_PROMPTS[4],
    cell: 'md:col-span-5',
    ratio: 'aspect-[16/9]',
  },
];

export function Showcase() {
  return (
    <section className="px-4 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold sm:text-[2.75rem] sm:leading-[1.05]">
            {m['landing.showcase.title']()}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            {m['landing.showcase.subtitle']()}
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 md:grid-cols-12">
          {ITEMS.map((item, i) => (
            <Reveal
              as="article"
              key={item.src}
              delay={(i % 3) * 70}
              className={cn('group flex flex-col', item.cell)}
            >
              <div
                className={cn(
                  'overflow-hidden rounded-2xl border border-white/10',
                  item.ratio,
                  item.cell.includes('row-span') && 'md:flex-1'
                )}
              >
                <img
                  src={item.src}
                  alt={item.label()}
                  width={item.w}
                  height={item.h}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <h3 className="font-sans text-sm font-semibold tracking-normal">
                  {item.label()}
                </h3>
                <button
                  type="button"
                  onClick={() => sendPromptToStudio(item.prompt)}
                  className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-1 text-sm font-medium"
                >
                  {m['landing.showcase.try']()}
                  <ArrowUpRight className="size-4" />
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
