import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Download, ImagePlus, Loader2 } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { apiGet, type PageResult } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type ImageRow = {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  prompt: string;
  mode: 'generate' | 'edit' | 'mask-edit';
  images: string[];
  createdAt: string;
};

const PAGE_SIZE = 12;

function statusText(status: ImageRow['status']) {
  if (status === 'pending') return m['settings.images.status_pending']();
  if (status === 'processing') return m['settings.images.status_processing']();
  return m['settings.images.status_failed']();
}

function ImagesPage() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['studio-images', page],
    queryFn: () =>
      apiGet<PageResult<ImageRow>>(
        `/api/image/history?page=${page}&pageSize=${PAGE_SIZE}`
      ),
    placeholderData: keepPreviousData,
    // Unfinished images keep moving server-side; refresh until they land.
    refetchInterval: (q) =>
      q.state.data?.items.some(
        (v) => v.status === 'pending' || v.status === 'processing'
      )
        ? 10_000
        : false,
  });
  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['settings.images.title']()}</h1>
        <p className="text-muted-foreground">
          {m['settings.images.description']()}
        </p>
      </div>

      {query.isPending ? (
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      ) : rows.length === 0 ? (
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-start gap-4">
            <p className="text-muted-foreground">
              {m['settings.images.empty']()}
            </p>
            <Link href="/#create" className={cn(buttonVariants(), 'gap-2')}>
              <ImagePlus className="size-4" />
              {m['settings.images.create']()}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((v) => {
            const url = v.images[0];
            return (
              <Card key={v.id} className="overflow-hidden py-0">
                <div className="bg-muted flex aspect-square w-full items-center justify-center">
                  {v.status === 'success' && url ? (
                    <img
                      src={url}
                      alt={v.prompt}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span
                      className={cn(
                        'text-sm',
                        v.status === 'failed'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      )}
                    >
                      {statusText(v.status)}
                    </span>
                  )}
                </div>
                <CardContent className="space-y-3 pb-4">
                  <p className="line-clamp-2 text-sm" title={v.prompt}>
                    {v.prompt}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">
                      {v.mode === 'generate'
                        ? m['settings.images.mode_generate']()
                        : m['settings.images.mode_edit']()}
                      {' · '}
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                    {v.status === 'success' && url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'sm' }),
                          'gap-1.5'
                        )}
                      >
                        <Download className="size-4" />
                        {m['settings.images.download']()}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3">
          <button
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {m['settings.images.prev']()}
          </button>
          <span className="text-muted-foreground text-sm">
            {page} / {pages}
          </span>
          <button
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {m['settings.images.next']()}
          </button>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/settings/images')({
  component: ImagesPage,
});
