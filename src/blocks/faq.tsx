import { m } from '@/paraglide/messages.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function faqItems() {
  return [
    [m['landing.faq.q1'](), m['landing.faq.a1']()],
    [m['landing.faq.q2'](), m['landing.faq.a2']()],
    [m['landing.faq.q3'](), m['landing.faq.a3']()],
    [m['landing.faq.q4'](), m['landing.faq.a4']()],
    [m['landing.faq.q5'](), m['landing.faq.a5']()],
    [m['landing.faq.q6'](), m['landing.faq.a6']()],
    [m['landing.faq.q7'](), m['landing.faq.a7']()],
    [m['landing.faq.q8'](), m['landing.faq.a8']()],
  ] as const;
}

export function FAQ({
  title,
  items = faqItems(),
}: {
  title?: string;
  items?: readonly (readonly [string, string])[];
} = {}) {
  const contact = m['landing.footer.contact']();
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <h2 className="text-3xl font-bold sm:text-[2.75rem] sm:leading-[1.05] lg:sticky lg:top-28">
            {title ?? m['landing.faq.title']()}
            <a
              href={`mailto:${contact}`}
              className="text-muted-foreground hover:text-foreground mt-5 block font-sans text-sm font-normal tracking-normal"
            >
              {contact}
            </a>
          </h2>
        </div>
        <Accordion className="w-full">
          {items.map(([q, a], i) => (
            <AccordionItem key={i} value={`q${i}`} className="border-white/10">
              <AccordionTrigger className="cursor-pointer py-5 text-left text-base font-semibold hover:no-underline">
                {q}
              </AccordionTrigger>
              {/* Kept in the DOM (hidden until found) so answers are indexable. */}
              <AccordionContent
                hiddenUntilFound
                className="text-muted-foreground pb-5 text-[15px] leading-relaxed"
              >
                {a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
