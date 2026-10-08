import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Drag-to-compare two frames of the same image. The handle is a native range
 * input stretched over the frame, so keyboard and screen readers work.
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  ariaLabel,
  width,
  height,
  className,
  priority = false,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  ariaLabel: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  const [pos, setPos] = useState(54);

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={after}
        alt={afterLabel}
        width={width}
        height={height}
        fetchPriority={priority ? 'high' : undefined}
        className="absolute inset-0 size-full object-cover select-none"
        draggable={false}
      />
      <img
        src={before}
        alt={beforeLabel}
        width={width}
        height={height}
        className="absolute inset-0 size-full object-cover select-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      {/* Divider + handle */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-px bg-white/80"
        style={{ left: `${pos}%` }}
      >
        <span className="bg-foreground text-background absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg">
          <MoveHorizontal className="size-4" />
        </span>
      </div>
      <span className="readout pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/65 px-2 py-1 text-[11px] text-white backdrop-blur">
        {beforeLabel}
      </span>
      <span className="readout pointer-events-none absolute right-3 bottom-3 rounded-md bg-black/65 px-2 py-1 text-[11px] text-white backdrop-blur">
        {afterLabel}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={ariaLabel}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
