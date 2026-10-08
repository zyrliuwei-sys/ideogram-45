import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MDXProvider } from '@mdx-js/react';

import { Link, usePathname } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { mdxComponents } from '@/components/mdx-components';

export const Route = createFileRoute('/(pages)')({
  component: PagesLayout,
});

function PagesLayout() {
  const pathname = usePathname();
  const links = [
    { href: '/privacy-policy', label: m['landing.footer.privacy']() },
    { href: '/terms-of-service', label: m['landing.footer.terms']() },
    { href: '/acceptable-use-policy', label: m['landing.footer.aup']() },
  ];

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
          <nav aria-label={m['landing.footer.legal']()} className="lg:pt-2">
            <div className="lg:sticky lg:top-28">
              <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {m['landing.footer.legal']()}
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm lg:flex-col">
                {links.map((l) => {
                  const active = pathname?.endsWith(l.href);
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className={cn(
                          'transition-colors',
                          active
                            ? 'text-foreground border-primary lg:border-l-2 lg:pl-3'
                            : 'text-muted-foreground hover:text-foreground lg:pl-3.5'
                        )}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
          <div className="max-w-[72ch]">
            <MDXProvider components={mdxComponents}>
              <Outlet />
            </MDXProvider>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
