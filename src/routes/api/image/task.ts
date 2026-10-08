import { createFileRoute } from '@tanstack/react-router';

import { FalProvider } from '@/core/ai';
import { getAuth } from '@/core/auth';
import { AITaskStatus, findTask } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

import { advance, STUDIO_MODEL, taskView } from './-pipeline';

// Poll a studio task; each poll asks fal once if it isn't finished yet.
async function GET({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user) return respErr('Unauthorized');

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return respErr('id is required');

    const task = await findTask(id);
    if (
      !task ||
      task.userId !== session.user.id ||
      task.model !== STUDIO_MODEL
    ) {
      return respErr('Task not found');
    }
    if (
      task.status === AITaskStatus.SUCCESS ||
      task.status === AITaskStatus.FAILED
    ) {
      return respData(taskView(task));
    }

    const configs = await getAllConfigs();
    const provider = new FalProvider({ apiKey: configs.fal_api_key });
    return respData(await advance(task.id, provider));
  } catch (error: any) {
    return respErr(error?.message || 'Query failed');
  }
}

export const Route = createFileRoute('/api/image/task')({
  server: { handlers: { GET } },
});
