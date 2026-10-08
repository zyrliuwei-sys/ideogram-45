import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';

/**
 * Two-column frame for the auth pages: a real edited image on the left
 * (wide screens only), the form on the right. Content arrives via props.
 */
export function AuthShell({
  name,
  quote,
  caption,
  image = '/imgs/studio/drift-1.webp',
  children,
}: {
  name: string;
  quote: string;
  caption: string;
  image?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-background text-foreground grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <img
          src={image}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.12_0.005_280/0.92)] via-[oklch(0.12_0.005_280/0.25)] to-[oklch(0.12_0.005_280/0.35)]" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src={envConfigs.app_logo}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-lg"
            />
            <span className="font-display text-lg font-bold">{name}</span>
          </Link>
          <div className="max-w-md">
            <p className="font-display text-4xl leading-[1.05] font-bold">
              {quote}
            </p>
            <p className="readout mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--lock)]">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              {caption}
            </p>
          </div>
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link
            href="/"
            className="font-display self-center text-xl font-bold lg:hidden"
          >
            {name}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
