import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { apiGet } from '@/lib/api-client';
import { track } from '@/lib/track';
import { m } from '@/paraglide/messages.js';

/** Report only an owned order that the server has confirmed paid. */
export function PaymentReturn() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [orderNo, setOrderNo] = useState<string | null>(null);
  useEffect(() => {
    setOrderNo(new URL(window.location.href).searchParams.get('paid'));
  }, []);
  const confirmation = useQuery({
    queryKey: ['checkout-confirmation', orderNo, session?.user?.id],
    queryFn: () =>
      apiGet<{
        orderNo: string;
        status: string;
        amount: number;
        currency: string;
        productId: string;
      }>(`/api/payment/status?order_no=${encodeURIComponent(orderNo!)}`),
    enabled: Boolean(orderNo && session?.user),
    refetchInterval: (q) =>
      q.state.data?.status === 'paid' ||
      q.state.data?.status === 'failed' ||
      q.state.dataUpdateCount >= 60
        ? false
        : 3000,
    retry: false,
  });
  useEffect(() => {
    const order = confirmation.data;
    if (!order || order.status !== 'paid') return;
    const key = `purchase-tracked:${order.orderNo}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === '1';
      sessionStorage.setItem(key, '1');
    } catch {}
    if (!seen)
      track('purchase', {
        transaction_id: order.orderNo,
        plan: order.productId,
        value: order.amount / 100,
        currency: order.currency.toUpperCase(),
      });
    queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
    toast.success(m['payment.return.confirmed']());
    const url = new URL(window.location.href);
    for (const k of ['paid', 'plan', 'value']) url.searchParams.delete(k);
    window.history.replaceState(window.history.state, '', url.toString());
    setOrderNo(null);
  }, [confirmation.data, queryClient]);
  if (!orderNo) return null;
  const failed = confirmation.data?.status === 'failed' || confirmation.isError;
  return (
    <div
      role="status"
      className="bg-background text-foreground fixed right-4 bottom-4 left-4 z-50 rounded-xl border p-4 text-sm shadow-lg sm:left-auto sm:max-w-sm"
    >
      <p>
        {failed
          ? m['payment.return.unconfirmed']()
          : m['payment.return.pending']()}
      </p>
      <button
        type="button"
        className="mt-2 underline"
        onClick={() => setOrderNo(null)}
      >
        {m['payment.return.dismiss']()}
      </button>
    </div>
  );
}
