import { useQuery } from '@tanstack/react-query';

import { DEFAULT_TIER_CREDITS, type IdeogramTier } from '@/config/ideogram';
import { apiGet } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { Reveal } from '@/components/reveal';

/** Long-form Ideogram 4.5 / Ideogram AI 4.5 guide: the page's SEO body. */
export function Guide() {
  const { data: price } = useQuery({
    queryKey: ['image-price'],
    queryFn: () => apiGet<Record<IdeogramTier, number>>('/api/image/price'),
    staleTime: 10 * 60_000,
  });

  const sections = [
    {
      id: 'what-is-ideogram-4-5',
      title: m['landing.guide.s1_title'](),
      body: [m['landing.guide.s1_body']()],
    },
    {
      id: 'drift-free-editing',
      title: m['landing.guide.s2_title'](),
      body: [m['landing.guide.s2_body']()],
    },
    {
      id: 'use-cases',
      title: m['landing.guide.s3_title'](),
      body: [m['landing.guide.s3_body']()],
      list: [
        m['landing.guide.s3_l1'](),
        m['landing.guide.s3_l2'](),
        m['landing.guide.s3_l3'](),
        m['landing.guide.s3_l4'](),
        m['landing.guide.s3_l5'](),
      ],
    },
    {
      id: 'prompting-tips',
      title: m['landing.guide.s4_title'](),
      body: [m['landing.guide.s4_body']()],
    },
    {
      id: 'ideogram-4-5-vs-earlier-models',
      title: m['landing.guide.s5_title'](),
      body: [m['landing.guide.s5_body']()],
    },
    {
      id: 'using-ideogram-ai-4-5',
      title: m['landing.guide.s6_title'](),
      body: [
        m['landing.guide.s6_body']({
          standard: price?.standard ?? DEFAULT_TIER_CREDITS.standard,
          high: price?.high ?? DEFAULT_TIER_CREDITS.high,
        }),
      ],
    },
  ];

  const stats = [
    [m['landing.guide.stat_1'](), m['landing.guide.stat_1_label']()],
    [m['landing.guide.stat_2'](), m['landing.guide.stat_2_label']()],
    [m['landing.guide.stat_3'](), m['landing.guide.stat_3_label']()],
  ];

  return (
    <section id="guide" className="scroll-mt-20 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <p className="readout text-primary text-xs tracking-[0.14em] uppercase">
            {m['landing.guide.eyebrow']()}
          </p>
          <h2 className="mt-3 text-3xl leading-[1.05] font-bold sm:text-[2.75rem]">
            {m['landing.guide.title']()}
          </h2>
          <p className="text-foreground/80 mt-6 text-lg leading-relaxed">
            {m['landing.guide.intro']()}
          </p>
        </Reveal>

        <dl className="mt-12 grid gap-6 border-y border-white/10 py-8 sm:grid-cols-3">
          {stats.map(([value, label]) => (
            <div key={label}>
              <dt className="font-display text-4xl font-bold tracking-tight">
                {value}
              </dt>
              <dd className="text-muted-foreground mt-1 text-sm">{label}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
          <nav
            aria-label={m['landing.guide.toc']()}
            className="hidden lg:block"
          >
            <div className="sticky top-28">
              <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">
                {m['landing.guide.toc']()}
              </p>
              <ul className="space-y-2.5 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-muted-foreground hover:text-foreground leading-snug transition-colors"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="max-w-[68ch] space-y-12">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h3 className="text-2xl font-bold sm:text-[1.75rem]">
                  {s.title}
                </h3>
                {s.body.map((p, i) => (
                  <p
                    key={i}
                    className="text-foreground/80 mt-4 text-[17px] leading-[1.75]"
                  >
                    {p}
                  </p>
                ))}
                {s.list && (
                  <ul className="mt-5 space-y-3">
                    {s.list.map((item) => {
                      // "Lead: detail" (or "Lead：detail") → bold lead.
                      const cut = item.search(/[:：]/);
                      const lead = cut > 0 ? item.slice(0, cut + 1) : '';
                      const rest = cut > 0 ? item.slice(cut + 1) : item;
                      return (
                        <li
                          key={item}
                          className="text-foreground/80 border-l border-white/15 pl-4 text-[16px] leading-relaxed"
                        >
                          {lead && (
                            <strong className="text-foreground font-semibold">
                              {lead}{' '}
                            </strong>
                          )}
                          {rest.trim()}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </article>
        </div>
      </div>
    </section>
  );
}
