import { createFileRoute } from '@tanstack/react-router';

import { FalProvider } from '@/core/ai';
import { getAuth } from '@/core/auth';
import {
  DEFAULT_ASPECT,
  isAspectRatio,
  isIdeogramTier,
  MAX_PROMPT_CHARS,
  resolveTierCredits,
} from '@/config/ideogram';
import {
  AITaskStatus,
  createTask,
  mergeTaskInfo,
} from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { screenPrompt } from '@/modules/content-safety/service';
import { getBalance } from '@/modules/credits/service';
import { hasPermission } from '@/modules/rbac/service';
import { respData, respErr } from '@/lib/resp';

import {
  buildInput,
  endpointFor,
  failTask,
  isImageInput,
  STUDIO_MODEL,
  submit,
  taskView,
  type StudioMode,
} from './-pipeline';

const PROMPT_BLOCKED = 'PROMPT_BLOCKED';

// Start one Ideogram 4.5 generation or edit. Credits are taken up front and
// refunded automatically if fal fails.
async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return respErr('Prompt is required');
    if (prompt.length > MAX_PROMPT_CHARS) return respErr('Prompt is too long');

    const tier = isIdeogramTier(body?.tier) ? body.tier : 'standard';
    const aspect = isAspectRatio(body?.aspect) ? body.aspect : DEFAULT_ASPECT;
    const expand = body?.expand === true;

    let image: string | undefined;
    let mask: string | undefined;
    if (body?.image !== undefined && body?.image !== null) {
      if (!isImageInput(body.image)) {
        return respErr('Upload a JPG, PNG or WebP image');
      }
      image = body.image;
      if (body?.mask !== undefined && body?.mask !== null) {
        if (!isImageInput(body.mask)) return respErr('Invalid mask');
        mask = body.mask;
      }
    }
    const mode: StudioMode = image ? (mask ? 'mask-edit' : 'edit') : 'generate';

    const configs = await getAllConfigs();
    if (!(await screenPrompt(prompt, configs)).allowed) {
      return respErr(PROMPT_BLOCKED);
    }

    // Admins generate free; everyone else pays the tier price in credits.
    const isAdmin = await hasPermission(session.user.id, 'admin.*');
    const price = resolveTierCredits(configs, tier);
    if (!isAdmin && (await getBalance(session.user.id)) < price) {
      return respErr('Insufficient credits');
    }
    if (!configs.fal_api_key) return respErr('Generation is not configured');

    const endpoint = endpointFor(configs, mode);
    const task = await createTask({
      userId: session.user.id,
      mediaType: 'image',
      provider: 'fal',
      model: STUDIO_MODEL,
      prompt,
      costCredits: isAdmin ? 0 : price,
    });

    try {
      const provider = new FalProvider({ apiKey: configs.fal_api_key });
      const requestId = await submit(
        provider,
        endpoint,
        prompt,
        buildInput({ endpoint, mode, tier, aspect, expand, image, mask })
      );
      await mergeTaskInfo(task.id, {
        endpoint,
        requestId,
        mode,
        tier,
        aspect: mode === 'generate' ? aspect : null,
      });
    } catch (error: any) {
      await failTask(task.id, error?.message || 'Generate failed');
      throw error;
    }

    return respData(
      taskView({
        ...task,
        status: AITaskStatus.PENDING,
        taskInfo: JSON.stringify({ mode, tier, aspect }),
      })
    );
  } catch (error: any) {
    return respErr(error?.message || 'Generate failed');
  }
}

export const Route = createFileRoute('/api/image/generate')({
  server: { handlers: { POST } },
});
