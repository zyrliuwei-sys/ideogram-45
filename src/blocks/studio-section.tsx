import { ShieldCheck } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import { ImageStudio } from '@/blocks/image-studio';

export function StudioSection() {
  return (
    <section className="px-4 pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              {m['landing.studio.section_title']()}
            </h2>
            <p className="text-muted-foreground mt-2">
              {m['landing.studio.section_desc']()}
            </p>
          </div>
          <Link
            href="/acceptable-use-policy"
            className="inline-flex items-center gap-1.5 text-[13px] text-red-200/80 hover:text-red-200"
          >
            <ShieldCheck className="size-4" />
            {m['landing.hero.notice']()}
          </Link>
        </div>
        <ImageStudio />
      </div>
    </section>
  );
}
