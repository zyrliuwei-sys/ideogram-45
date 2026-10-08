import { createFileRoute } from '@tanstack/react-router';

import { FalProvider } from '@/core/ai';
import { envConfigs } from '@/config';
import { AITaskStatus, listTasksByStatus } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

import { advance, failTask, STUDIO_MODEL } from './-pipeline';

const CRON_KEY_HEADER = 'x-cron-key';
const TASK_TIMEOUT_MS = 30 * 60 * 1000;

// Background sweep, called every minute by the Workers cron trigger (see
// src/nitro/cron.ts): finishes studio tasks whose page was closed and times
// out stuck ones (failing a task refunds its credits).
async function POST({ request }: { request: Request }) {
  const secret = envConfigs.auth_secret;
  if (!secret || request.headers.get(CRON_KEY_HEADER) !== secret) {
    return respErr('Unauthorized');
  }

  const configs = await getAllConfigs();
  if (!configs.fal_api_key) return respData({ skipped: true });
  const provider = new FalProvider({ apiKey: configs.fal_api_key });
  const now = Date.now();
  const stats = { advanced: 0, timedOut: 0 };

  const active = await listTasksByStatus({
    model: STUDIO_MODEL,
    statuses: [AITaskStatus.PENDING, AITaskStatus.PROCESSING],
    limit: 25,
  });
  for (const task of active) {
    try {
      if (now - new Date(task.createdAt).getTime() > TASK_TIMEOUT_MS) {
        await failTask(task.id, 'Generation timed out');
        stats.timedOut++;
      } else {
        await advance(task.id, provider);
        stats.advanced++;
      }
    } catch (error) {
      console.error('image cron: task failed to advance', task.id, error);
    }
  }
  return respData(stats);
}

export const Route = createFileRoute('/api/image/cron')({
  server: { handlers: { POST } },
});
