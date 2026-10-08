import { m } from '@/paraglide/messages.js';
import { Reveal } from '@/components/reveal';

export function HowItWorks() {
  const steps = [
    [m['landing.how.s1_title'](), m['landing.how.s1_desc']()],
    [m['landing.how.s2_title'](), m['landing.how.s2_desc']()],
    [m['landing.how.s3_title'](), m['landing.how.s3_desc']()],
  ] as const;

  return (
    <section id="how" className="px-4 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <Reveal className="proof order-2 lg:order-1">
          <img
            src="/imgs/studio/proofs.webp"
            alt=""
            loading="lazy"
            className="aspect-[4/3] w-full rounded-2xl border border-white/10 object-cover"
          />
        </Reveal>
        <Reveal delay={100} className="order-1 lg:order-2">
          <h2 className="text-3xl font-bold sm:text-[2.5rem] sm:leading-[1.08]">
            {m['landing.how.title']()}
          </h2>
          <ol className="mt-8 space-y-7">
            {steps.map(([title, desc]) => (
              <li key={title} className="border-primary/60 border-l-2 pl-5">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-1.5 leading-relaxed">
                  {desc}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
