import type { AnchorHTMLAttributes, HTMLAttributes } from 'react';
import type { MDXComponents } from 'mdx/types';

import { cn } from '@/lib/utils';

export const mdxComponents: MDXComponents = {
  h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn(
        'text-foreground mt-10 mb-3 text-2xl font-bold md:text-[1.75rem]',
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        'text-foreground mt-10 mb-3 text-xl font-bold md:text-[1.4rem]',
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn(
        'text-foreground mt-7 mb-2 text-lg font-semibold',
        className
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className={cn('text-foreground/85 mt-3 leading-[1.75]', className)}
      {...props}
    />
  ),
  a: ({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className={cn(
        'text-primary font-medium underline-offset-4 hover:underline',
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn(
        'marker:text-primary/70 mt-3 ml-5 list-disc space-y-2',
        className
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn(
        'marker:text-primary/70 mt-3 ml-5 list-decimal space-y-2',
        className
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => (
    <li
      className={cn('text-foreground/85 pl-1 leading-[1.75]', className)}
      {...props}
    />
  ),
  strong: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
    <strong
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn(
        'border-primary/60 text-foreground/80 my-6 border-l-2 pl-5',
        className
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
    <code
      className={cn(
        'bg-muted text-foreground rounded px-[0.4rem] py-[0.2rem] font-mono text-sm',
        className
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: HTMLAttributes<HTMLHRElement>) => (
    <hr className={cn('border-border my-8', className)} {...props} />
  ),
};
