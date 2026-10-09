import { createFileRoute } from '@tanstack/react-router';
import { and, eq } from 'drizzle-orm';

import { getAuth } from '@/core/auth';
import { db } from '@/core/db';
import { aiTask } from '@/config/db/schema';
import { AITaskStatus, findTask } from '@/modules/ai-tasks/service';
import { getStorage } from '@/modules/storage/service';
import { md5 } from '@/lib/hash';
import { readLimitedJson } from '@/lib/limited-json';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

import { STUDIO_MODEL, taskView } from './-pipeline';

async function POST({ request }: { request: Request }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return respErr('Invalid origin', { status: 403 });
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user) return respErr('Unauthorized', { status: 401 });
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: 1000,
      keyPrefix: 'finalize-image',
      extraKey: session.user.id,
    });
    if (limited) return limited;
    const body = (await readLimitedJson(request, 28 * 1024 * 1024)) as {
      id?: unknown;
      image?: unknown;
    };
    if (typeof body?.id !== 'string') return respErr('Invalid task');
    const task = await findTask(body.id);
    if (
      !task ||
      task.userId !== session.user.id ||
      task.model !== STUDIO_MODEL ||
      task.status !== AITaskStatus.SUCCESS ||
      task.deletedAt
    )
      return respErr('Task not found');
    const info = JSON.parse(task.taskInfo || '{}');
    if (info.mode !== 'mask-edit') return respErr('Not a masked edit');
    const previous = JSON.parse(task.taskResult || '{}');
    if (previous.pixelLocked) return respData(taskView(task));
    if (
      typeof body.image !== 'string' ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.image)
    )
      return respErr('Invalid PNG');
    const bytes = Uint8Array.from(
      atob(body.image.slice('data:image/png;base64,'.length)),
      (c) => c.charCodeAt(0)
    );
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (
      bytes.length < 33 ||
      bytes.length > 20 * 1024 * 1024 ||
      !signature.every((b, i) => bytes[i] === b) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR'
    )
      return respErr('Invalid PNG');
    const view = new DataView(bytes.buffer);
    const width = view.getUint32(16),
      height = view.getUint32(20);
    if (!width || !height || width > 2048 || height > 2048)
      return respErr('Image dimensions too large');
    const storage = await getStorage();
    if (!storage) return respErr('Image storage is not configured');
    const uploaded = await storage.uploadFile({
      body: bytes,
      key: `ideogram/images/${md5(task.id)}-locked-${md5(bytes)}.png`,
      contentType: 'image/png',
      disposition: 'inline',
    });
    if (!uploaded.success || !uploaded.url)
      return respErr('Could not save image');
    // Conditional update avoids replacing a finalized result from another tab.
    await db()
      .update(aiTask)
      .set({
        taskResult: JSON.stringify({
          ...previous,
          images: [{ url: uploaded.url }],
          pixelLocked: true,
        }),
      })
      .where(
        and(
          eq(aiTask.id, task.id),
          eq(aiTask.userId, session.user.id),
          eq(aiTask.taskResult, task.taskResult!)
        )
      );
    return respData(taskView(await findTask(task.id)));
  } catch {
    return respErr('Could not save edited image');
  }
}
export const Route = createFileRoute('/api/image/finalize')({
  server: { handlers: { POST } },
});
