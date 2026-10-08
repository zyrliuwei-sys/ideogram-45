import { ArrowRight, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { Reveal } from '@/components/reveal';

// A real masked-edit sequence (fal Ideogram edit + Pixel Lock), measured
// pixel-by-pixel on the lossless 1152×864 PNGs before compression.
const W = 1152;
const H = 864;
const FRAMES = [
  { src: '/imgs/studio/drift-0.webp', rect: null, prev: null, orig: 100 },
  {
    src: '/imgs/studio/drift-1.webp',
    rect: [540, 380, 745, 500],
    prev: 97.5,
    orig: 97.5,
  },
  {
    src: '/imgs/studio/drift-2.webp',
    rect: [180, 455, 425, 610],
    prev: 96.18,
    orig: 93.67,
  },
  {
    src: '/imgs/studio/drift-3.webp',
    rect: [790, 470, 990, 690],
    prev: 95.54,
    orig: 89.21,
  },
] as const;

function frameLabel(i: number) {
  if (i === 1) return m['landing.drift.step_1']();
  if (i === 2) return m['landing.drift.step_2']();
  if (i === 3) return m['landing.drift.step_3']();
  return m['landing.drift.step_0']();
}

/** Contact sheet: the original and each pass, side by side, with readouts. */
export function DriftDemo() {
  return (
    <section id="drift" className="scroll-mt-20 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <p className="readout text-primary text-xs tracking-[0.14em] uppercase">
            {m['landing.drift.eyebrow']()}
          </p>
          <h2 className="mt-3 text-3xl leading-[1.05] font-bold sm:text-[2.75rem]">
            {m['landing.drift.title']()}
          </h2>
          <p className="text-muted-foreground mt-5 text-lg leading-relaxed">
            {m['landing.drift.description']()}
          </p>
        </Reveal>

        <ol className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {FRAMES.map((f, i) => (
            <Reveal as="li" key={f.src} delay={i * 90}>
              <div className="proof">
                <div
                  className="relative overflow-hidden rounded-xl border border-white/10"
                  style={{ aspectRatio: `${W} / ${H}` }}
                >
                  <img
                    src={f.src}
                    alt={frameLabel(i)}
                    width={W}
                    height={H}
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                  {f.rect && (
                    <div
                      aria-hidden
                      className="absolute rounded-[3px] outline outline-1 outline-[var(--edit)]"
                      style={{
                        left: `${(f.rect[0] / W) * 100}%`,
                        top: `${(f.rect[1] / H) * 100}%`,
                        width: `${((f.rect[2] - f.rect[0]) / W) * 100}%`,
                        height: `${((f.rect[3] - f.rect[1]) / H) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm font-medium">{frameLabel(i)}</p>
              <p
                className={cn(
                  'readout mt-1 text-2xl font-semibold',
                  f.prev ? 'text-[var(--lock)]' : 'text-foreground/40'
                )}
              >
                {f.prev ? `${f.prev.toFixed(1)}%` : '100%'}
              </p>
              <p className="text-muted-foreground text-xs">
                {f.prev
                  ? m['landing.drift.identical_prev']()
                  : m['landing.drift.source']()}
              </p>
              {f.prev && (
                <p className="readout text-muted-foreground mt-1 text-[11px]">
                  {f.orig.toFixed(1)}% {m['landing.drift.identical_orig']()}
                </p>
              )}
            </Reveal>
          ))}
        </ol>

        <div className="mt-12 grid gap-8 border-t border-white/10 pt-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-lg font-semibold text-[var(--lock)]">
              <Lock className="size-4" />
              {m['landing.drift.claim']()}
            </p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {m['landing.drift.typical_body']()}
            </p>
            <p className="text-muted-foreground/70 mt-2 text-xs">
              {m['landing.drift.note']()}
            </p>
          </div>
          <a
            href="#create"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 justify-self-start rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap"
          >
            {m['landing.drift.cta']()}
            <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
