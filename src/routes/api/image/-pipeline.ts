/**
 * Ideogram 4.5 studio pipeline — one fal call per task, finished by polling.
 *
 * Three modes, picked from what the user sent:
 *   - generate   prompt only                     → ideogram_generate_model
 *   - mask-edit  source image + painted mask     → ideogram_mask_edit_model
 *   - edit       source image, no mask           → ideogram_edit_model
 *
 * The fal endpoint is stored in the task's taskInfo so a poll (browser or the
 * every-minute cron sweep) queries the right queue even after an admin swaps
 * endpoints. Finished images are copied to R2 when storage is configured,
 * because fal media URLs are temporary.
 */

import { AIMediaType, FalProvider, AITaskStatus as FalStatus } from '@/core/ai';
import {
  ASPECT_RATIOS,
  DEFAULT_ENDPOINTS,
  type AspectRatio,
  type IdeogramTier,
} from '@/config/ideogram';
import { AITaskStatus, findTask, updateTask } from '@/modules/ai-tasks/service';
import { getStorage } from '@/modules/storage/service';

/** aiTask.model for every studio task (history + cron filter on it). */
export const STUDIO_MODEL = 'ideogram-4.5-studio';

export type StudioMode = 'generate' | 'mask-edit' | 'edit';

// Client downsizes uploads to ≤ 2048 px; this is a hard ceiling per image.
const MAX_IMAGE_CHARS = 12 * 1024 * 1024;
const DATA_IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** A source image is an uploaded data URI or a previous result's https URL. */
export function isImageInput(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_CHARS) return false;
  if (DATA_IMAGE_RE.test(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function endpointFor(
  configs: Record<string, string>,
  mode: StudioMode
): string {
  if (mode === 'generate') {
    return configs.ideogram_generate_model || DEFAULT_ENDPOINTS.generate;
  }
  if (mode === 'mask-edit') {
    return configs.ideogram_mask_edit_model || DEFAULT_ENDPOINTS.maskEdit;
  }
  return configs.ideogram_edit_model || DEFAULT_ENDPOINTS.edit;
}

/**
 * fal input for one request. Ideogram 4.5, Ideogram V3 and GPT Image take
 * different fields.
 */
export function buildInput(params: {
  endpoint: string;
  mode: StudioMode;
  tier: IdeogramTier;
  aspect: AspectRatio;
  expand: boolean;
  image?: string;
  mask?: string;
}): Record<string, unknown> {
  const { endpoint, mode, tier, aspect, expand, image, mask } = params;
  const isIdeogram = endpoint.includes('ideogram');
  const isIdeogramV3 = /ideogram\/v3/.test(endpoint);
  const options: Record<string, unknown> = { num_images: 1 };

  if (isIdeogramV3) {
    options.rendering_speed = tier === 'high' ? 'QUALITY' : 'BALANCED';
    options.expand_prompt = expand;
  } else {
    options.quality = tier === 'high' ? 'high' : 'medium';
    // 4.5 edit has no prompt expansion; only its generate endpoint does.
    if (isIdeogram && mode === 'generate') {
      options.enable_prompt_expansion = expand;
    }
  }

  if (mode === 'generate') {
    options.image_size = ASPECT_RATIOS[aspect];
  } else if (mode === 'mask-edit') {
    options.image_url = image;
    options.mask_url = mask;
  } else if (isIdeogram) {
    options.image_url = image;
  } else {
    options.image_urls = [image];
  }
  return options;
}

export async function submit(
  provider: FalProvider,
  endpoint: string,
  prompt: string,
  options: Record<string, unknown>
) {
  const res = await provider.generate({
    params: { mediaType: AIMediaType.IMAGE, model: endpoint, prompt, options },
  });
  return res.taskId;
}

type StudioInfo = {
  endpoint?: string;
  requestId?: string;
  mode?: StudioMode;
  tier?: IdeogramTier;
  aspect?: AspectRatio;
  source?: string | null;
};

function infoOf(task: any): StudioInfo {
  try {
    return task.taskInfo ? JSON.parse(task.taskInfo) : {};
  } catch {
    return {};
  }
}

function resultOf(task: any): any {
  try {
    return task.taskResult ? JSON.parse(task.taskResult) : {};
  } catch {
    return {};
  }
}

/** What the browser sees for a task. */
export function taskView(task: any) {
  const info = infoOf(task);
  const result = resultOf(task);
  return {
    id: task.id as string,
    status: task.status as AITaskStatus,
    prompt: (task.prompt as string) ?? '',
    mode: info.mode ?? 'generate',
    tier: info.tier ?? 'standard',
    aspect: info.aspect ?? null,
    costCredits: Number(task.costCredits) || 0,
    images: (result.images ?? [])
      .map((i: any) => i?.url)
      .filter(Boolean) as string[],
    error: (result.error as string) ?? null,
  };
}

async function persistImages(taskId: string, images: { url: string }[]) {
  try {
    const storage = await getStorage();
    if (!storage) return images;
    return await Promise.all(
      images.map(async (image, i) => {
        const uploaded = await storage.downloadAndUpload({
          url: image.url,
          key: `ideogram/images/${taskId}-${i}.png`,
          contentType: 'image/png',
          disposition: 'inline',
        });
        return uploaded.success && uploaded.url ? { url: uploaded.url } : image;
      })
    );
  } catch (error) {
    console.error('persistImages failed', taskId, error);
    return images;
  }
}

/** Failing a task refunds its credits (ai-tasks updateTask → revoke). */
export async function failTask(taskId: string, message: string) {
  await updateTask({
    taskId,
    status: AITaskStatus.FAILED,
    taskResult: { error: message },
  });
}

/** Ask fal once and record the outcome. Returns the fresh view. */
export async function advance(taskId: string, provider: FalProvider) {
  const task = await findTask(taskId);
  if (!task) throw new Error('Task not found');
  if (
    task.status === AITaskStatus.SUCCESS ||
    task.status === AITaskStatus.FAILED
  ) {
    return taskView(task);
  }

  const info = infoOf(task);
  if (!info.endpoint || !info.requestId) return taskView(task);

  let res;
  try {
    res = await provider.query({
      taskId: info.requestId,
      model: info.endpoint,
      mediaType: AIMediaType.IMAGE,
    });
  } catch (error: any) {
    // fal reports a failed run as COMPLETED + an error on the result fetch.
    await failTask(task.id, error?.message || 'Generation failed');
    return taskView(await findTask(task.id));
  }

  if (res.taskStatus === FalStatus.FAILED) {
    await failTask(task.id, 'Generation failed');
  } else if (res.taskStatus === FalStatus.SUCCESS) {
    const raw: any[] = res.taskResult?.images ?? [];
    const images = raw
      .map((i) => ({ url: i?.url as string }))
      .filter((i) => i.url);
    if (!images.length) {
      await failTask(task.id, 'No image returned');
    } else {
      await updateTask({
        taskId: task.id,
        status: AITaskStatus.SUCCESS,
        taskResult: { images: await persistImages(task.id, images) },
      });
    }
  } else if (
    res.taskStatus === FalStatus.PROCESSING &&
    task.status !== AITaskStatus.PROCESSING
  ) {
    await updateTask({ taskId: task.id, status: AITaskStatus.PROCESSING });
  }

  return taskView(await findTask(task.id));
}
