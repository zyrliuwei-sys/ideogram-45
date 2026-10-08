import { createFileRoute } from '@tanstack/react-router';

import { IDEOGRAM_TIERS, resolveTierCredits } from '@/config/ideogram';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

// Live credit price per tier, so the generator quotes what it will charge.
async function GET() {
  try {
    const configs = await getAllConfigs();
    return respData(
      Object.fromEntries(
        IDEOGRAM_TIERS.map((tier) => [tier, resolveTierCredits(configs, tier)])
      )
    );
  } catch (error: any) {
    return respErr(error?.message || 'Query failed');
  }
}

export const Route = createFileRoute('/api/image/price')({
  server: { handlers: { GET } },
});
