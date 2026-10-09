import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';

// A disposable, real D1 engine. No production DB or provider requests are used.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');
const runtime = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok") } }',
  compatibilityDate: '2026-05-01',
  d1Databases: ['DB'],
});
const binding = await runtime.getD1Database('DB');
for (const file of [
  '0000_wooden_venom.sql',
  '0001_pretty_colonel_america.sql',
]) {
  const migration = await readFile(
    new URL(`../drizzle/${file}`, import.meta.url),
    'utf8'
  );
  await binding.batch(
    migration
      .split('--> statement-breakpoint')
      .map((sql) => sql.trim())
      .filter(Boolean)
      .map((sql) => binding.prepare(sql))
  );
}
process.env.DATABASE_PROVIDER = 'd1';
process.env.AUTH_SECRET = 'test-only-auth-secret-with-no-production-use';
(globalThis as any).__CF_ENV__ = { DB: binding };
const credits = await import('../src/modules/credits/service');
const { db } = await import('../src/core/db');
const schema = await import('../src/config/db/schema');
const { getAuth } = await import('../src/core/auth');
const { handlePaymentCallback, getCheckoutStatus } =
  await import('../src/modules/payment/service');
const { PayPalProvider } = await import('../src/core/payment/paypal');
const { readLimitedJson } = await import('../src/lib/limited-json');
const { eq } = await import('drizzle-orm');
await db()
  .insert(schema.config)
  .values([
    { name: 'welcome_email_enabled', value: 'false' },
    { name: 'initial_credits_enabled', value: 'true' },
    { name: 'initial_credits_amount', value: '9999' },
    { name: 'paypal_enabled', value: 'true' },
    { name: 'paypal_client_id', value: 'test-client' },
    { name: 'paypal_client_secret', value: 'test-only-secret' },
  ]);
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  assert.ok(
    /^https:\/\/api-m(?:\.sandbox)?\.paypal\.com\//.test(url),
    `Unexpected network request: ${url}`
  );
  if (url.endsWith('/v1/oauth2/token'))
    return Response.json({ access_token: 'test-token', expires_in: 3600 });
  if (url.includes('/v2/checkout/orders/'))
    return Response.json({
      id: 'test-session',
      status: 'COMPLETED',
      create_time: new Date().toISOString(),
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: 'test-capture',
                amount: { value: '9.90', currency_code: 'USD' },
                create_time: new Date().toISOString(),
              },
            ],
          },
        },
      ],
    });
  throw new Error('Unexpected provider request');
}) as typeof fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await runtime.dispose();
});
async function user(id: string, verified = true) {
  const row = {
    id,
    name: id,
    email: `${id}@example.test`,
    emailVerified: verified,
  };
  await db().insert(schema.user).values(row);
  return row;
}

test('registration hooks: Google only; no email grant, linking grant, unverified grant, or repeated grant', async () => {
  const hooks = getAuth({ email_and_password_enabled: 'true' }).options
    .databaseHooks;
  const googleUser = await user('google');
  const context = {};
  await hooks.user.create.after(googleUser, context);
  await hooks.account.create.after(
    { userId: 'google', providerId: 'google' },
    context
  );
  await hooks.account.create.after(
    { userId: 'google', providerId: 'google' },
    context
  );
  assert.equal(await credits.getBalance('google'), 42);
  const emailUser = await user('email');
  const emailContext = {};
  await hooks.user.create.after(emailUser, emailContext);
  await hooks.account.create.after(
    { userId: 'email', providerId: 'credential' },
    emailContext
  );
  await hooks.account.create.after(
    { userId: 'email', providerId: 'google' },
    {}
  );
  assert.equal(await credits.getBalance('email'), 0);
  const unverified = await user('unverified', false);
  const unverifiedContext = {};
  await hooks.user.create.after(unverified, unverifiedContext);
  await hooks.account.create.after(
    { userId: 'unverified', providerId: 'google' },
    unverifiedContext
  );
  assert.equal(await credits.getBalance('unverified'), 0);
});

test('one Google trial cannot fund two concurrent generations; concurrent refunds restore it once', async () => {
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      credits.consume({ userId: 'google', credits: 42 })
    )
  );
  const successes = results.filter((result) => result.success);
  assert.equal(successes.length, 1);
  assert.equal(await credits.getBalance('google'), 0);
  await credits.grantGoogleTrial({
    userId: 'google',
    userEmail: 'google@example.test',
    providerId: 'google',
    emailVerified: true,
    isNewRegistration: true,
    configs: {},
  });
  assert.equal(await credits.getBalance('google'), 0);
  await Promise.all(
    Array.from({ length: 4 }, () =>
      credits.revoke(successes[0].consumedCredit.id)
    )
  );
  assert.equal(await credits.getBalance('google'), 42);
});

test('expiring credits are spent before non-expiring credits', async () => {
  await user('fifo');
  const permanent = await credits.grant({ userId: 'fifo', credits: 42 });
  const expiring = await credits.grant({
    userId: 'fifo',
    credits: 42,
    expiresAt: new Date(Date.now() + 86400000),
  });
  assert.equal(
    (await credits.consume({ userId: 'fifo', credits: 42 })).success,
    true
  );
  const rows = await db()
    .select()
    .from(schema.credit)
    .where(eq(schema.credit.userId, 'fifo'));
  assert.equal(
    rows.find((row: any) => row.id === permanent.id).remainingCredits,
    42
  );
  assert.equal(
    rows.find((row: any) => row.id === expiring.id).remainingCredits,
    0
  );
});

test('concurrent payment callbacks grant credits only once; status is private to the owner', async () => {
  await user('buyer');
  await db().insert(schema.order).values({
    id: 'test-order',
    orderNo: 'test-order',
    userId: 'buyer',
    status: 'created',
    amount: 990,
    currency: 'usd',
    paymentProvider: 'paypal',
    paymentSessionId: 'test-session',
    paymentType: 'one-time',
    checkoutInfo: '{}',
    creditsAmount: 990,
  });
  await Promise.all(
    Array.from({ length: 4 }, () => handlePaymentCallback('test-order'))
  );
  assert.equal(await credits.getBalance('buyer'), 990);
  assert.equal(
    (await getCheckoutStatus('buyer', 'test-order'))?.status,
    'paid'
  );
  assert.equal(await getCheckoutStatus('email', 'test-order'), null);
});

test('PayPal approval and activation without a payment do not grant paid status', async () => {
  const provider = new PayPalProvider({
    clientId: 'test-client',
    clientSecret: 'test-only-secret',
  });
  const build = (provider as any).buildPaymentSessionFromSubscription.bind(
    provider
  );
  for (const status of ['APPROVED', 'ACTIVE']) {
    assert.equal(
      (
        await build({
          id: 'test-sub',
          status,
          create_time: new Date().toISOString(),
        })
      ).paymentStatus,
      'processing'
    );
  }
  const paid = await build({
    id: 'test-sub',
    status: 'ACTIVE',
    billing_info: {
      last_payment: {
        amount: { value: '19.00', currency_code: 'USD' },
        time: new Date().toISOString(),
      },
    },
  });
  assert.equal(paid.paymentStatus, 'paid');
  const sale = await build(
    { id: 'test-sub', status: 'ACTIVE', create_time: new Date().toISOString() },
    {
      id: 'test-sale',
      state: 'completed',
      create_time: new Date().toISOString(),
      amount: { total: '19.00', currency: 'USD' },
    }
  );
  assert.equal(sale.paymentStatus, 'paid');
  assert.equal(sale.paymentInfo.paymentAmount, 1900);
});

test('chunked JSON uploads have a hard size limit', async () => {
  const request = new Request('https://example.test', {
    method: 'POST',
    body: JSON.stringify({ image: 'x'.repeat(100) }),
  });
  await assert.rejects(readLimitedJson(request, 50), /Request too large/);
  assert.deepEqual(
    await readLimitedJson(
      new Request('https://example.test', {
        method: 'POST',
        body: '{"ok":true}',
      }),
      100
    ),
    { ok: true }
  );
});

test('late task completion cannot overwrite an already finalized result', async () => {
  const { settleTask, AITaskStatus } =
    await import('../src/modules/ai-tasks/service');
  await db()
    .insert(schema.aiTask)
    .values({
      id: 'locked-task',
      userId: 'google',
      mediaType: 'image',
      provider: 'fal',
      model: 'ideogram-4.5-studio',
      prompt: 'test',
      status: 'success',
      taskResult: JSON.stringify({
        images: [{ url: 'https://example.test/locked.png' }],
        pixelLocked: true,
      }),
    });
  assert.equal(
    await settleTask({
      taskId: 'locked-task',
      status: AITaskStatus.SUCCESS,
      taskResult: { images: [{ url: 'https://example.test/raw.png' }] },
    }),
    false
  );
  const [task] = await db()
    .select()
    .from(schema.aiTask)
    .where(eq(schema.aiTask.id, 'locked-task'));
  assert.equal(JSON.parse(task.taskResult).pixelLocked, true);
});

test('a D1 generation can combine many small grants atomically', async () => {
  await user('many-grants');
  for (let i = 0; i < 50; i++)
    await credits.grant({ userId: 'many-grants', credits: 1 });
  assert.equal(
    (await credits.consume({ userId: 'many-grants', credits: 42 })).success,
    true
  );
  assert.equal(await credits.getBalance('many-grants'), 8);
});
