import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Brush,
  Coins,
  Download,
  Eraser,
  ImagePlus,
  Loader2,
  Lock,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import {
  ASPECT_RATIOS,
  DEFAULT_ASPECT,
  DEFAULT_TIER_CREDITS,
  isAspectRatio,
  isIdeogramTier,
  MAX_PROMPT_CHARS,
  type AspectRatio,
  type IdeogramTier,
  type MaskEditColor,
} from '@/config/ideogram';
import { EXAMPLE_PROMPTS, RANDOM_PROMPTS } from '@/config/studio-prompts';
import { apiGet, apiPost } from '@/lib/api-client';
import {
  readStudioDraft,
  registerStudioDraftSaver,
  writeStudioDraft,
} from '@/lib/studio-draft';
import { onStudioPrompt } from '@/lib/studio-events';
import { track } from '@/lib/track';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { Switch } from '@/components/ui/switch';

const PaywallDialog = lazy(() => import('@/blocks/paywall-dialog'));

type Mode = 'generate' | 'edit';

type StudioTask = {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  images: string[];
  error: string | null;
  costCredits: number;
};

/** Everything the browser keeps about the image being edited. */
type Source = {
  /** Lossless pixels — the Pixel Lock baseline and the download. */
  png: string;
  /** What gets uploaded to the model (JPEG keeps the request small). */
  upload: string;
  width: number;
  height: number;
};

type Pass = {
  id: string;
  url: string;
  prompt: string;
  locked: boolean;
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 2048;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const DRAFT_KEY = 'ig45-studio-draft';

const INSUFFICIENT_CREDITS = 'Insufficient credits';
const PROMPT_BLOCKED = 'PROMPT_BLOCKED';
const NOT_CONFIGURED = 'Generation is not configured';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

/** Draw an image (capped at MAX_SIDE) and return lossless + upload copies. */
async function toSource(src: string): Promise<Source> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  return {
    png: canvas.toDataURL('image/png'),
    upload: canvas.toDataURL('image/jpeg', 0.92),
    width,
    height,
  };
}

/**
 * The painted area becomes `editColor` (the color the endpoint changes),
 * everything else the opposite color (kept).
 */
function exportMask(maskCanvas: HTMLCanvasElement, editColor: MaskEditColor) {
  const [paint, keep] =
    editColor === 'black' ? ['#000', '#fff'] : ['#fff', '#000'];
  const { width, height } = maskCanvas;
  const painted = document.createElement('canvas');
  painted.width = width;
  painted.height = height;
  const pctx = painted.getContext('2d')!;
  pctx.drawImage(maskCanvas, 0, 0);
  pctx.globalCompositeOperation = 'source-in';
  pctx.fillStyle = paint;
  pctx.fillRect(0, 0, width, height);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = keep;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(painted, 0, 0);
  return out.toDataURL('image/png');
}

/**
 * Pixel Lock: paste the model's result into the painted area only. The
 * mask is feathered inward (blurred, then clipped to the hard mask), so
 * every unpainted pixel is copied from the source exactly.
 */
async function pixelLock(
  source: Source,
  resultUrl: string,
  maskCanvas: HTMLCanvasElement
) {
  const [base, result] = await Promise.all([
    loadImage(source.png),
    loadImage(resultUrl),
  ]);
  const { width, height } = source;

  const soft = document.createElement('canvas');
  soft.width = width;
  soft.height = height;
  const sctx = soft.getContext('2d')!;
  sctx.filter = `blur(${Math.max(2, Math.round(width / 320))}px)`;
  sctx.drawImage(maskCanvas, 0, 0);
  sctx.filter = 'none';
  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(maskCanvas, 0, 0);

  const patch = document.createElement('canvas');
  patch.width = width;
  patch.height = height;
  const pctx = patch.getContext('2d')!;
  pctx.drawImage(result, 0, 0, width, height);
  pctx.globalCompositeOperation = 'destination-in';
  pctx.drawImage(soft, 0, 0);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(base, 0, 0, width, height);
  ctx.drawImage(patch, 0, 0);
  // Throws on a tainted canvas (result host without CORS) — caller falls back.
  return out.toDataURL('image/png');
}

function paintedShare(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  if (!width || !height) return 0;
  const data = canvas
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, width, height).data;
  let painted = 0;
  let total = 0;
  for (let i = 3; i < data.length; i += 16) {
    total++;
    if (data[i] > 8) painted++;
  }
  return total ? painted / total : 0;
}

function readDraft(): { prompt?: string; mode?: Mode } {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function ImageStudio() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);

  const [mode, setMode] = useState<Mode>('generate');
  const [prompt, setPrompt] = useState('');
  const [tier, setTier] = useState<IdeogramTier>('standard');
  const [aspect, setAspect] = useState<AspectRatio>(DEFAULT_ASPECT);
  const [expand, setExpand] = useState(false);

  const [source, setSource] = useState<Source | null>(null);
  const [tool, setTool] = useState<'brush' | 'erase'>('brush');
  const [brush, setBrush] = useState(48);
  const [lockOn, setLockOn] = useState(true);
  const [painted, setPainted] = useState(0);

  const [taskId, setTaskId] = useState<string | null>(null);
  // Edit mode: paint the mask on the source, or look at the latest result.
  const [view, setView] = useState<'paint' | 'result'>('paint');
  const [passes, setPasses] = useState<Pass[]>([]);
  const [activePass, setActivePass] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [paywallMounted, setPaywallMounted] = useState(false);
  if (paywall && !paywallMounted) setPaywallMounted(true);

  const maskRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  // The source + mask a running edit was submitted with (Pixel Lock input).
  const submitted = useRef<{
    source: Source | null;
    mask: HTMLCanvasElement | null;
    prompt: string;
  } | null>(null);

  const [draftReady, setDraftReady] = useState(false);
  const restoredMask = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const draft = await readStudioDraft();
        if (cancelled) return;
        if (draft) {
          setPrompt(
            typeof draft.prompt === 'string'
              ? draft.prompt.slice(0, MAX_PROMPT_CHARS)
              : ''
          );
          setMode(draft.mode === 'edit' ? 'edit' : 'generate');
          if (isIdeogramTier(draft.tier)) setTier(draft.tier);
          if (isAspectRatio(draft.aspect)) setAspect(draft.aspect);
          setExpand(draft.expand === true);
          setLockOn(draft.lockOn !== false);
          if (
            draft.source?.png?.startsWith('data:image/png;') &&
            draft.source.width > 0 &&
            draft.source.width <= MAX_SIDE &&
            draft.source.height > 0 &&
            draft.source.height <= MAX_SIDE
          ) {
            restoredMask.current = draft.mask;
            setSource(draft.source);
          }
        } else {
          const legacy = readDraft();
          if (legacy.prompt) setPrompt(legacy.prompt);
          if (legacy.mode === 'edit') setMode('edit');
        }
      } catch {
        const legacy = readDraft();
        if (!cancelled && legacy.prompt) setPrompt(legacy.prompt);
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDraft = useCallback(async () => {
    if (!draftReady) return;
    try {
      await writeStudioDraft({
        prompt,
        mode,
        tier,
        aspect,
        expand,
        lockOn,
        source,
        mask:
          source && maskRef.current
            ? maskRef.current.toDataURL('image/png')
            : null,
      });
    } catch {
      // Text still survives when IndexedDB is unavailable; navigation warns below.
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ prompt, mode }));
      } catch {}
      throw new Error(m['landing.studio.draft_save_failed']());
    }
  }, [draftReady, prompt, mode, tier, aspect, expand, lockOn, source]);

  useEffect(() => registerStudioDraftSaver(persistDraft), [persistDraft]);
  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      void persistDraft().catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [persistDraft, painted, draftReady]);

  useEffect(() => {
    const draft = readDraft();
    if (draft.prompt) setPrompt(draft.prompt);
    if (draft.mode) setMode(draft.mode);
  }, []);

  useEffect(
    () =>
      onStudioPrompt((p) => {
        setMode('generate');
        setPrompt(p);
      }),
    []
  );

  const priceQuery = useQuery({
    queryKey: ['image-price'],
    queryFn: () =>
      apiGet<Record<IdeogramTier, number> & { maskEditColor?: MaskEditColor }>(
        '/api/image/price'
      ),
    staleTime: 10 * 60_000,
  });
  const price = priceQuery.data?.[tier] ?? DEFAULT_TIER_CREDITS[tier];

  const creditsQuery = useQuery({
    queryKey: ['credits-balance'],
    queryFn: () => apiGet<{ balance: number }>('/api/credits'),
    enabled: signedIn,
  });

  // Size the mask canvas to the source whenever a new source arrives (or
  // the edit tab remounts the canvas).
  useEffect(() => {
    const canvas = maskRef.current;
    if (!canvas || !source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d')!.clearRect(0, 0, source.width, source.height);
    setPainted(0);
    const savedMask = restoredMask.current;
    restoredMask.current = null;
    if (savedMask) {
      void loadImage(savedMask)
        .then((image) => {
          if (maskRef.current !== canvas) return;
          canvas
            .getContext('2d')!
            .drawImage(image, 0, 0, source.width, source.height);
          setPainted(paintedShare(canvas));
        })
        .catch(() => {});
    }
  }, [source, mode]);

  const openPaywall = () => {
    track('paywall_open', { from: 'studio' });
    setPaywall(true);
  };

  const generate = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<StudioTask>('/api/image/generate', body),
    onSuccess: (task) => {
      setTaskId(task.id);
      queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
    },
    onError: (e: Error) => {
      if (e.message === INSUFFICIENT_CREDITS) return openPaywall();
      if (e.message === PROMPT_BLOCKED) {
        return toast.error(m['landing.studio.blocked']());
      }
      if (e.message === NOT_CONFIGURED) {
        return toast.error(m['landing.studio.not_configured']());
      }
      toast.error(e.message);
    },
  });

  const finalize = useMutation({
    mutationFn: (body: { id: string; image: string }) =>
      apiPost<StudioTask>('/api/image/finalize', body),
  });
  const [finishing, setFinishing] = useState(false);
  const taskQuery = useQuery({
    queryKey: ['image-task', taskId],
    queryFn: () => apiGet<StudioTask>(`/api/image/task?id=${taskId}`),
    enabled: Boolean(taskId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'success' || s === 'failed' ? false : 2500;
    },
  });
  const task = taskQuery.data;
  const working =
    finishing ||
    generate.isPending ||
    (Boolean(taskId) &&
      task?.status !== 'success' &&
      task?.status !== 'failed');

  // Finish a task once: apply Pixel Lock if it was a masked edit, then
  // append the pass.
  const finished = useRef<string | null>(null);
  useEffect(() => {
    if (!task || finished.current === task.id) return;
    if (task.status === 'failed') {
      finished.current = task.id;
      setTaskId(null);
      toast.error(m['landing.studio.failed']());
      queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      return;
    }
    if (task.status !== 'success' || !task.images[0]) return;
    finished.current = task.id;
    setFinishing(true);
    const raw = task.images[0];
    const ctx = submitted.current;
    (async () => {
      let url = raw;
      let locked = false;
      if (ctx?.source && ctx.mask) {
        try {
          url = await pixelLock(ctx.source, raw, ctx.mask);
          locked = true;
          try {
            const saved = await finalize.mutateAsync({
              id: task.id,
              image: url,
            });
            url = saved.images[0] || url;
            queryClient.invalidateQueries({ queryKey: ['studio-images'] });
          } catch {
            toast.error(m['landing.studio.result_save_failed']());
          }
        } catch {
          toast.message(m['landing.studio.lock_unavailable']());
        }
      }
      const pass = { id: task.id, url, prompt: ctx?.prompt ?? '', locked };
      setPasses((prev) => [...prev, pass]);
      setActivePass(task.id);
      setView('result');
      setTaskId(null);
      setFinishing(false);
      track('generate_success', { mode: ctx?.source ? 'edit' : 'generate' });
    })();
  }, [task, queryClient]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      return toast.error(m['landing.studio.image_bad']());
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return toast.error(m['landing.studio.image_too_big']());
    }
    const url = URL.createObjectURL(file);
    try {
      setSource(await toSource(url));
      setView('paint');
    } catch {
      toast.error(m['landing.studio.image_bad']());
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function keepEditing(pass: Pass) {
    try {
      setSource(await toSource(pass.url));
      setMode('edit');
      setPrompt('');
      setActivePass(pass.id);
      setView('paint');
    } catch {
      toast.error(m['landing.studio.image_bad']());
    }
  }

  async function submit() {
    const text = prompt.trim();
    if (!text) return toast.error(m['landing.studio.prompt_required']());
    if (mode === 'edit' && !source) {
      return toast.error(m['landing.studio.image_required']());
    }
    if (!signedIn) {
      try {
        await persistDraft();
      } catch (error) {
        return toast.error((error as Error).message);
      }
      router.push(`/sign-in?callbackUrl=${encodeURIComponent('/#create')}`);
      return;
    }
    // The server is the authority on balance (admins generate free); an
    // "Insufficient credits" reply opens the paywall.
    try {
      await persistDraft();
    } catch (error) {
      return toast.error((error as Error).message);
    }
    let mask: string | undefined;
    let maskSnapshot: HTMLCanvasElement | null = null;
    if (mode === 'edit' && maskRef.current && painted > 0) {
      mask = exportMask(
        maskRef.current,
        priceQuery.data?.maskEditColor ?? 'black'
      );
      // Snapshot so further painting doesn't change the lock of this run.
      maskSnapshot = document.createElement('canvas');
      maskSnapshot.width = maskRef.current.width;
      maskSnapshot.height = maskRef.current.height;
      maskSnapshot.getContext('2d')!.drawImage(maskRef.current, 0, 0);
    }
    submitted.current = {
      source: mode === 'edit' ? source : null,
      mask: mode === 'edit' && lockOn ? maskSnapshot : null,
      prompt: text,
    };
    track('generate_submit', { mode, tier });
    generate.mutate({
      prompt: text,
      tier,
      aspect,
      expand,
      image: mode === 'edit' ? source?.upload : undefined,
      mask,
    });
  }

  // ── Mask painting ────────────────────────────────────────────────────
  const pointFor = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      scale: canvas.width / rect.width,
    };
  }, []);

  function stroke(
    from: { x: number; y: number },
    to: { x: number; y: number },
    scale: number
  ) {
    const ctx = maskRef.current!.getContext('2d')!;
    ctx.globalCompositeOperation =
      tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = 'rgba(240, 176, 74, 1)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush * scale;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (working) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFor(e);
    drawing.current = p;
    stroke(p, p, p.scale);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = pointFor(e);
    stroke(drawing.current, p, p.scale);
    drawing.current = p;
  }
  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = null;
    if (maskRef.current) setPainted(paintedShare(maskRef.current));
    void persistDraft().catch(() => {});
  }
  function clearMask() {
    const c = maskRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setPainted(0);
  }

  const shown = passes.find((p) => p.id === activePass) ?? passes.at(-1);
  const lockedPct = Math.round((1 - painted) * 1000) / 10;

  const showPaint = mode === 'edit' && source && (view === 'paint' || !shown);
  const fieldset = 'border-t border-white/10 pt-4';
  const legend = 'text-muted-foreground mb-2.5 text-xs font-medium';

  return (
    <div
      id="create"
      className="panel grid scroll-mt-24 overflow-hidden rounded-3xl lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      {/* ── Workbench: canvas + prompt dock ───────────────────────── */}
      <div className="flex min-w-0 flex-col border-white/10 lg:border-r">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
            {(['generate', 'edit'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                aria-pressed={mode === tab}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                  mode === tab
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'generate' ? (
                  <Sparkles className="size-4" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                {tab === 'generate'
                  ? m['landing.studio.tab_generate']()
                  : m['landing.studio.tab_edit']()}
              </button>
            ))}
          </div>
          {mode === 'edit' && source && shown && (
            <div className="inline-flex rounded-lg border border-white/10 p-0.5 text-xs">
              {(['paint', 'result'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    'rounded-md px-3 py-1',
                    view === v
                      ? 'text-foreground bg-white/10'
                      : 'text-muted-foreground'
                  )}
                >
                  {v === 'paint'
                    ? m['landing.studio.view_paint']()
                    : m['landing.studio.view_result']()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="relative flex min-h-[340px] flex-1 items-center justify-center bg-black/25 p-4 sm:min-h-[460px] sm:p-6">
          {mode === 'edit' && !source && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className="hover:border-primary/60 flex aspect-[4/3] w-full max-w-lg flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-center transition-colors"
            >
              <ImagePlus className="text-primary size-7" />
              <span className="text-sm font-medium">
                {m['landing.studio.upload_title']()}
              </span>
              <span className="text-muted-foreground text-xs">
                {m['landing.studio.upload_hint']()}
              </span>
            </button>
          )}

          {/* Mask editor stays mounted (hidden) so the painted mask survives
              switching to the result view. */}
          {mode === 'edit' && source && (
            <div
              className={cn(
                'proof proof-edit relative w-full',
                !showPaint && 'hidden'
              )}
              style={{
                aspectRatio: `${source.width} / ${source.height}`,
                maxHeight: 520,
                maxWidth: `calc(520px * ${source.width / source.height})`,
              }}
            >
              <img
                src={source.png}
                alt=""
                className="absolute inset-0 size-full rounded-lg object-contain select-none"
                draggable={false}
              />
              <canvas
                ref={maskRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute inset-0 size-full cursor-crosshair rounded-lg opacity-55 mix-blend-screen"
                style={{ touchAction: 'none' }}
              />
            </div>
          )}

          {(mode === 'generate' || (source && !showPaint)) &&
            (shown ? (
              <div
                className={cn('proof relative', shown.locked && 'proof-lock')}
              >
                <img
                  src={shown.url}
                  alt={shown.prompt}
                  className="max-h-[520px] w-auto max-w-full rounded-lg object-contain"
                />
                {shown.locked && (
                  <span className="readout absolute top-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-[11px] text-[var(--lock)] backdrop-blur">
                    <Lock className="size-3" />
                    {m['landing.studio.lock_label']()}
                  </span>
                )}
              </div>
            ) : (
              mode === 'generate' && (
                <div className="text-muted-foreground flex flex-col items-center gap-2 text-center text-sm">
                  <ImagePlus className="size-8 opacity-50" />
                  {m['landing.studio.output_empty']()}
                </div>
              )
            ))}

          {working && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center text-sm backdrop-blur-sm">
              <div className="relative size-14 overflow-hidden rounded-xl border border-white/15">
                <div
                  className="via-primary/60 absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent to-transparent"
                  style={{ animation: 'scan 1.4s linear infinite' }}
                />
              </div>
              {m['landing.studio.output_working']()}
            </div>
          )}
        </div>

        {/* Result actions + session strip */}
        {shown && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
            <a
              href={shown.url}
              download={`ideogram-4-5-${shown.id.slice(0, 8)}.png`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-sm hover:border-white/25"
            >
              <Download className="size-4" />
              {m['landing.studio.download']()}
            </a>
            <button
              type="button"
              onClick={() => keepEditing(shown)}
              disabled={working}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-sm hover:border-white/25 disabled:opacity-60"
            >
              <Wand2 className="size-4" />
              {m['landing.studio.keep_editing']()}
            </button>
            {passes.length > 1 && (
              <div className="ml-auto flex gap-1.5 overflow-x-auto">
                {passes.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePass(p.id);
                      setView('result');
                    }}
                    title={m['landing.studio.pass']({ n: i + 1 })}
                    className={cn(
                      'shrink-0 overflow-hidden rounded-md border-2',
                      shown.id === p.id
                        ? 'border-primary'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    )}
                  >
                    <img src={p.url} alt="" className="size-10 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prompt dock */}
        <div className="border-t border-white/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="studio-prompt" className="text-sm font-medium">
              {mode === 'edit'
                ? m['landing.studio.edit_label']()
                : m['landing.studio.prompt_label']()}
              <span className="text-primary"> *</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setPrompt(
                    RANDOM_PROMPTS[
                      Math.floor(Math.random() * RANDOM_PROMPTS.length)
                    ]
                  )
                }
                className="text-primary hover:bg-primary/10 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
              >
                <Shuffle className="size-3.5" />
                {m['landing.studio.random']()}
              </button>
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1 text-xs"
              >
                <Trash2 className="size-3.5" />
                {m['landing.studio.clear']()}
              </button>
            </div>
          </div>
          <textarea
            id="studio-prompt"
            value={prompt}
            maxLength={MAX_PROMPT_CHARS}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === 'edit'
                ? m['landing.studio.edit_placeholder']()
                : m['landing.studio.prompt_placeholder']()
            }
            rows={3}
            className="placeholder:text-muted-foreground/70 focus:border-primary/50 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-[15px] leading-relaxed outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {mode === 'generate' &&
              EXAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs transition-colors hover:border-white/25"
                >
                  <Sparkles className="size-3" />
                  {m['landing.studio.example']({ n: i + 1 })}
                </button>
              ))}
            <span className="readout text-muted-foreground ml-auto text-[11px]">
              {prompt.length} / {MAX_PROMPT_CHARS}
            </span>
          </div>
        </div>
      </div>

      {/* ── Inspector ─────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-4 border-t border-white/10 p-4 lg:border-t-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {m['landing.studio.settings']()}
          </p>
          {signedIn && creditsQuery.data && (
            <span className="readout text-muted-foreground text-xs">
              {m['landing.studio.balance']({
                credits: creditsQuery.data.balance,
              })}
            </span>
          )}
        </div>

        <div>
          <p className={legend}>{m['landing.studio.model']()}</p>
          <div className="grid gap-2">
            {(['standard', 'high'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left transition-colors',
                  tier === t
                    ? 'border-primary/70 bg-primary/10'
                    : 'border-white/10 hover:border-white/25'
                )}
              >
                <span className="flex items-center justify-between text-sm font-semibold">
                  {t === 'standard'
                    ? m['landing.studio.model_standard']()
                    : m['landing.studio.model_high']()}
                  <span className="text-primary readout text-xs">
                    {priceQuery.data?.[t] ?? DEFAULT_TIER_CREDITS[t]}
                    <Coins className="ml-0.5 inline size-3" />
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {t === 'standard'
                    ? m['landing.studio.model_standard_hint']()
                    : m['landing.studio.model_high_hint']()}
                </span>
              </button>
            ))}
          </div>
        </div>

        {mode === 'generate' ? (
          <>
            <div className={fieldset}>
              <p className={legend}>{m['landing.studio.aspect']()}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(ASPECT_RATIOS) as AspectRatio[]).map((a) => {
                  const [w, h] = a.split(':').map(Number);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAspect(a)}
                      aria-pressed={aspect === a}
                      className={cn(
                        'readout flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition-colors',
                        aspect === a
                          ? 'border-primary/70 bg-primary/10 text-foreground'
                          : 'text-muted-foreground border-white/10 hover:border-white/25'
                      )}
                    >
                      <span
                        className="inline-block rounded-[2px] border border-current"
                        style={{
                          width: w >= h ? 16 : (16 * w) / h,
                          height: h >= w ? 16 : (16 * h) / w,
                        }}
                      />
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              className={cn(
                fieldset,
                'flex items-center justify-between gap-3'
              )}
            >
              <span className="text-muted-foreground text-xs font-medium">
                {m['landing.studio.detail']()}
              </span>
              <div className="inline-flex rounded-lg border border-white/10 p-0.5">
                {[false, true].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setExpand(v)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs',
                      expand === v
                        ? 'text-foreground bg-white/10'
                        : 'text-muted-foreground'
                    )}
                  >
                    {v
                      ? m['landing.studio.detail_expanded']()
                      : m['landing.studio.detail_balanced']()}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {source && (
              <div className={fieldset}>
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-muted-foreground text-xs font-medium">
                    {m['landing.studio.mask_title']()}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-muted-foreground hover:text-foreground rounded-md px-1.5 py-0.5 text-xs"
                    >
                      {m['landing.studio.replace']()}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSource(null)}
                      className="text-muted-foreground hover:text-foreground rounded-md px-1.5 py-0.5 text-xs"
                    >
                      {m['landing.studio.remove']()}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-white/10 p-0.5">
                    {(['brush', 'erase'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTool(t);
                          setView('paint');
                        }}
                        aria-pressed={tool === t}
                        className={cn(
                          'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs',
                          tool === t
                            ? 'text-foreground bg-white/10'
                            : 'text-muted-foreground'
                        )}
                      >
                        {t === 'brush' ? (
                          <Brush className="size-3.5" />
                        ) : (
                          <Eraser className="size-3.5" />
                        )}
                        {t === 'brush'
                          ? m['landing.studio.brush']()
                          : m['landing.studio.erase']()}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={clearMask}
                    className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1 text-xs"
                  >
                    <RotateCcw className="size-3.5" />
                    {m['landing.studio.clear_mask']()}
                  </button>
                </div>
                <label className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
                  {m['landing.studio.brush_size']()}
                  <input
                    type="range"
                    min={8}
                    max={140}
                    value={brush}
                    onChange={(e) => setBrush(Number(e.target.value))}
                    className="accent-primary flex-1"
                  />
                </label>
                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  {painted > 0 ? (
                    <span className="readout text-[var(--lock)]">
                      <Lock className="mr-1 inline size-3" />
                      {m['landing.studio.locked_pct']({
                        pct: lockedPct.toFixed(1),
                      })}
                    </span>
                  ) : (
                    m['landing.studio.mask_none']()
                  )}
                </p>
              </div>
            )}
            <div
              className={cn(fieldset, 'flex items-start justify-between gap-3')}
            >
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Lock className="size-3.5 text-[var(--lock)]" />
                  {m['landing.studio.lock_label']()}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {m['landing.studio.lock_hint']()}
                </p>
              </div>
              <Switch
                checked={lockOn}
                onCheckedChange={(v) => setLockOn(Boolean(v))}
                aria-label={m['landing.studio.lock_label']()}
              />
            </div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT.join(',')}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {/* Cost + submit pinned to the bottom of the inspector */}
        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>{m['landing.studio.cost']()}</span>
            <span>
              <span className="text-primary readout text-lg font-semibold">
                −{price}
              </span>{' '}
              {m['landing.studio.credits']()}
            </span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={working}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-between gap-3 rounded-xl px-5 py-3 text-base font-semibold whitespace-nowrap transition-colors disabled:opacity-60"
          >
            {working ? (
              <>
                {m['landing.studio.generating']()}
                <Loader2 className="size-4 animate-spin" />
              </>
            ) : (
              <>
                {!signedIn
                  ? m['landing.studio.sign_in']()
                  : mode === 'edit'
                    ? m['landing.studio.apply_edit']()
                    : m['landing.studio.generate']()}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground block text-center text-xs"
          >
            {m['landing.studio.cost_guide']()}
          </Link>
        </div>
      </aside>

      {paywallMounted && (
        <Suspense fallback={null}>
          <PaywallDialog open={paywall} onOpenChange={setPaywall} />
        </Suspense>
      )}
    </div>
  );
}
