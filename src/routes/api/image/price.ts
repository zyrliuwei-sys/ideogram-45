import { createFileRoute } from '@tanstack/react-router';

import {
  IDEOGRAM_TIERS,
  maskEditColorFor,
  resolveTierCredits,
} from '@/config/ideogram';
import { getAllConfigs } from '@/modules/config/service';
import { respData, respErr } from '@/lib/resp';

import { endpointFor } from './-pipeline';

// Live credit price per tier, so the generator quotes what it will charge,
// plus the mask color the current masked-edit endpoint treats as "change".
async function GET() {
  try {
    const configs = await getAllConfigs();
    return respData({
      ...Object.fromEntries(
        IDEOGRAM_TIERS.map((tier) => [tier, resolveTierCredits(configs, tier)])
      ),
      maskEditColor: maskEditColorFor(endpointFor(configs, 'mask-edit')),
    });
  } catch (error: any) {
    return respErr(error?.message || 'Query failed');
  }
}

export const Route = createFileRoute('/api/image/price')({
  server: { handlers: { GET } },
});
