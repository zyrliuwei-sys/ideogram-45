import {
  CalendarDays,
  Expand,
  Layers,
  Lock,
  PaintBucket,
  Sparkles,
  Unlock,
  type LucideIcon,
} from 'lucide-react';

import { m } from '@/paraglide/messages.js';
import { Reveal } from '@/components/reveal';

function Fact({
  icon: Icon,
  label,
  value,
  desc,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground flex items-center gap-2 text-[13px]">
        <Icon className="text-primary size-4" />
        {label}
      </p>
      <p className="font-display mt-3 text-2xl leading-tight font-bold">
        {value}
      </p>
      <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

export function Why() {
  const facts: [LucideIcon, string, string, string][] = [
    [
      CalendarDays,
      m['landing.why.released'](),
      m['landing.why.released_value'](),
      m['landing.why.released_desc'](),
    ],
    [
      Layers,
      m['landing.why.focus'](),
      m['landing.why.focus_value'](),
      m['landing.why.focus_desc'](),
    ],
    [
      Sparkles,
      m['landing.why.output'](),
      m['landing.why.output_value'](),
      m['landing.why.output_desc'](),
    ],
    [
      Expand,
      m['landing.why.largest'](),
      m['landing.why.largest_value'](),
      m['landing.why.largest_desc'](),
    ],
    [
      PaintBucket,
      m['landing.why.masks'](),
      m['landing.why.masks_value'](),
      m['landing.why.masks_desc'](),
    ],
    [
      Unlock,
      m['landing.why.weights'](),
      m['landing.why.weights_value'](),
      m['landing.why.weights_desc'](),
    ],
  ];

  return (
    <section className="px-4 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        {/* Left: heading + the workspace's own guarantee, on the real image */}
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-3xl font-bold sm:text-[2.75rem] sm:leading-[1.05]">
            {m['landing.why.title']()}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            {m['landing.why.subtitle']()}
          </p>
          <div className="proof proof-lock mt-8">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
              <img
                src="/imgs/studio/drift-1.webp"
                width={1152}
                height={864}
                alt={m['landing.drift.step_1']()}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.005_280/0.95)] via-[oklch(0.12_0.005_280/0.4)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="readout flex items-center gap-1.5 text-xs text-[var(--lock)]">
                  <Lock className="size-3.5" />
                  {m['landing.why.lock']()}
                </p>
                <p className="font-display mt-2 text-2xl font-bold">
                  {m['landing.why.lock_value']()}
                </p>
                <p className="text-foreground/80 mt-1.5 max-w-sm text-sm leading-relaxed">
                  {m['landing.why.lock_desc']()}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Right: the spec sheet */}
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:pt-3">
          {facts.map(([icon, label, value, desc], i) => (
            <Reveal key={label} delay={(i % 2) * 70}>
              <Fact icon={icon} label={label} value={value} desc={desc} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
