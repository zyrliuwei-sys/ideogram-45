import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { getCheckoutStatus } from '@/modules/payment/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return respErr('Unauthorized', { status: 401 });
  const orderNo = new URL(request.url).searchParams.get('order_no');
  if (!orderNo || orderNo.length > 100) return respErr('Invalid order');
  const status = await getCheckoutStatus(session.user.id, orderNo);
  if (!status) return respErr('Order not found', { status: 404 });
  return respData(status, { headers: { 'cache-control': 'no-store' } });
}
export const Route = createFileRoute('/api/payment/status')({
  server: { handlers: { GET } },
});
