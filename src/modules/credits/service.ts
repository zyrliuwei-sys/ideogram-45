import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  isNull,
  or,
  sql,
  sum,
} from 'drizzle-orm';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { credit } from '@/config/db/schema';
import { resolveTierCredits } from '@/config/ideogram';
import { isGoogleTrialEligible } from '@/lib/google-trial';
import { getSnowId, getUuid } from '@/lib/hash';

// --- Enums ---

export enum CreditStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

export enum CreditTransactionType {
  GRANT = 'grant',
  CONSUME = 'consume',
}

export enum CreditTransactionScene {
  PAYMENT = 'payment',
  SUBSCRIPTION = 'subscription',
  RENEWAL = 'renewal',
  GIFT = 'gift',
  REWARD = 'reward',
}

type NewCredit = typeof credit.$inferInsert;

// --- Expiration ---

export function calculateCreditExpirationTime(params: {
  creditsValidDays: number;
  currentPeriodEnd?: Date;
}): Date | null {
  const { creditsValidDays, currentPeriodEnd } = params;

  if (!creditsValidDays || creditsValidDays <= 0) {
    return null; // never expires
  }

  if (currentPeriodEnd) {
    return new Date(currentPeriodEnd.getTime());
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + creditsValidDays);
  return expiresAt;
}

function validCreditConditions(userId: string) {
  const now = new Date();
  return and(
    eq(credit.userId, userId),
    eq(credit.transactionType, CreditTransactionType.GRANT),
    eq(credit.status, CreditStatus.ACTIVE),
    gt(credit.remainingCredits, 0),
    or(isNull(credit.expiresAt), gt(credit.expiresAt, now))
  );
}

// --- Balance ---

export async function getBalance(userId: string): Promise<number> {
  const [result] = await db()
    .select({ total: sum(credit.remainingCredits) })
    .from(credit)
    .where(validCreditConditions(userId));

  return parseInt(result?.total || '0');
}

// --- Grant ---

export async function grant(params: {
  userId: string;
  userEmail?: string;
  credits: number;
  description?: string;
  orderNo?: string;
  subscriptionNo?: string;
  scene?: string;
  expiresAt?: Date | null;
}) {
  const newCredit: NewCredit = {
    id: getUuid(),
    userId: params.userId,
    userEmail: params.userEmail || '',
    transactionNo: getSnowId(),
    transactionType: CreditTransactionType.GRANT,
    transactionScene: params.scene || CreditTransactionScene.GIFT,
    credits: params.credits,
    remainingCredits: params.credits,
    status: CreditStatus.ACTIVE,
    description: params.description || 'Grant credit',
    orderNo: params.orderNo || '',
    subscriptionNo: params.subscriptionNo || '',
    expiresAt: params.expiresAt !== undefined ? params.expiresAt : null,
  };

  await db().insert(credit).values(newCredit);
  return newCredit;
}

// --- Consume (FIFO with batching) ---

export async function consume(params: {
  userId: string;
  userEmail?: string;
  credits: number;
  scene?: string;
  description?: string;
  metadata?: string;
  tx?: any;
}): Promise<{ success: boolean; consumedCredit?: any }> {
  const {
    userId,
    userEmail,
    credits: amount,
    scene,
    description,
    metadata,
    tx,
  } = params;
  const now = new Date();
  if (!Number.isSafeInteger(amount) || amount <= 0) return { success: false };

  if (envConfigs.database_provider === 'd1') {
    // D1 serializes each batch atomically. Insert the consumption only when
    // every source balance still matches, then deduct only if that insert won.
    for (let attempt = 0; attempt < 4; attempt++) {
      const grants = await db()
        .select()
        .from(credit)
        .where(validCreditConditions(userId))
        .orderBy(
          sql`case when ${credit.expiresAt} is null then 1 else 0 end`,
          asc(credit.expiresAt),
          asc(credit.createdAt)
        )
        .limit(10000);
      let remaining = amount;
      const items: {
        creditId: string;
        transactionNo: string;
        creditsConsumed: number;
        creditsBefore: number;
        creditsAfter: number;
      }[] = [];
      for (const source of grants) {
        if (remaining <= 0) break;
        const used = Math.min(remaining, source.remainingCredits);
        items.push({
          creditId: source.id,
          transactionNo: source.transactionNo,
          creditsConsumed: used,
          creditsBefore: source.remainingCredits,
          creditsAfter: source.remainingCredits - used,
        });
        remaining -= used;
      }
      if (remaining > 0 || !items.length) return { success: false };
      const consumedCredit: NewCredit = {
        id: getUuid(),
        userId,
        userEmail: userEmail || '',
        transactionNo: getSnowId(),
        transactionType: CreditTransactionType.CONSUME,
        transactionScene: scene || '',
        status: CreditStatus.ACTIVE,
        description: description || '',
        credits: -amount,
        remainingCredits: 0,
        consumedDetail: JSON.stringify(items),
        metadata: metadata || '',
        createdAt: now,
        updatedAt: now,
      };
      const selection = Object.fromEntries(
        Object.keys(getTableColumns(credit)).map((key) => {
          const value = consumedCredit[key as keyof NewCredit];
          return [
            key,
            sql`${value instanceof Date ? value.getTime() : (value ?? null)}`,
          ];
        })
      );
      // JSON keeps bound parameters and expression depth constant across many grants.
      const unchanged = sql`not exists (
        select 1 from json_each(${JSON.stringify(items)}) as snapshot
        left join ${credit} as source_grant on source_grant.id = json_extract(snapshot.value, '$.creditId')
        where source_grant.id is null
          or source_grant.remaining_credits <> json_extract(snapshot.value, '$.creditsBefore')
          or source_grant.status <> ${CreditStatus.ACTIVE}
          or (source_grant.expires_at is not null and source_grant.expires_at <= ${now.getTime()})
      )`;
      const insert = db()
        .insert(credit)
        .select(
          db()
            .select(selection)
            .from(credit)
            .where(and(eq(credit.id, items[0].creditId), unchanged))
            .limit(1)
        )
        .returning();
      const won = sql`exists (select 1 from ${credit} as consumption where consumption.id = ${consumedCredit.id})`;
      const updates = items.map((item) =>
        db()
          .update(credit)
          .set({
            remainingCredits: sql`${credit.remainingCredits} - ${item.creditsConsumed}`,
          })
          .where(and(eq(credit.id, item.creditId), won))
      );
      const results = await db().batch([insert, ...updates]);
      if (results[0].length) return { success: true, consumedCredit };
    }
    return { success: false };
  }

  const execute = async (tx: any) => {
    // 1. Check balance
    const [balance] = await tx
      .select({ total: sum(credit.remainingCredits) })
      .from(credit)
      .where(
        and(
          eq(credit.userId, userId),
          eq(credit.transactionType, CreditTransactionType.GRANT),
          eq(credit.status, CreditStatus.ACTIVE),
          gt(credit.remainingCredits, 0),
          or(isNull(credit.expiresAt), gt(credit.expiresAt, now))
        )
      );

    if (!balance?.total || parseInt(balance.total) < amount) {
      return { success: false };
    }

    // 2. FIFO consumption with batching
    let remainingToConsume = amount;
    const batchSize = 1000;
    const maxBatches = 10;
    let batchNo = 0;
    const consumedItems: any[] = [];

    while (remainingToConsume > 0 && batchNo < maxBatches) {
      const batchCredits = await tx
        .select()
        .from(credit)
        .where(
          and(
            eq(credit.userId, userId),
            eq(credit.transactionType, CreditTransactionType.GRANT),
            eq(credit.status, CreditStatus.ACTIVE),
            gt(credit.remainingCredits, 0),
            or(isNull(credit.expiresAt), gt(credit.expiresAt, now))
          )
        )
        .orderBy(
          sql`case when ${credit.expiresAt} is null then 1 else 0 end`,
          asc(credit.expiresAt)
        )
        .limit(batchSize)
        .for('update');

      if (!batchCredits || batchCredits.length === 0) break;

      for (const item of batchCredits) {
        if (remainingToConsume <= 0) break;
        const toConsume = Math.min(remainingToConsume, item.remainingCredits);

        await tx
          .update(credit)
          .set({ remainingCredits: item.remainingCredits - toConsume })
          .where(eq(credit.id, item.id));

        consumedItems.push({
          creditId: item.id,
          transactionNo: item.transactionNo,
          creditsConsumed: toConsume,
          creditsBefore: item.remainingCredits,
          creditsAfter: item.remainingCredits - toConsume,
        });

        remainingToConsume -= toConsume;
      }

      batchNo++;
    }

    // 3. Create consumption record
    const consumedCredit: NewCredit = {
      id: getUuid(),
      userId,
      userEmail: userEmail || '',
      transactionNo: getSnowId(),
      transactionType: CreditTransactionType.CONSUME,
      transactionScene: scene || '',
      status: CreditStatus.ACTIVE,
      description: description || '',
      credits: -amount,
      remainingCredits: 0,
      consumedDetail: JSON.stringify(consumedItems),
      metadata: metadata || '',
    };
    await tx.insert(credit).values(consumedCredit);

    return { success: true, consumedCredit };
  };

  if (tx) return execute(tx);
  return db().transaction(execute);
}

// --- Revoke (restore credits from a consumed record) ---

export async function revoke(consumeCreditId: string) {
  const [consumeRecord] = await db()
    .select()
    .from(credit)
    .where(
      and(
        eq(credit.id, consumeCreditId),
        eq(credit.transactionType, CreditTransactionType.CONSUME),
        eq(credit.status, CreditStatus.ACTIVE)
      )
    )
    .limit(1);

  if (!consumeRecord || !consumeRecord.consumedDetail) return;

  const items = JSON.parse(consumeRecord.consumedDetail);

  const apply = async (tx: any, batch = false) => {
    const eligible = sql`exists (select 1 from ${credit} as refund_source where refund_source.id = ${consumeCreditId} and refund_source.status = ${CreditStatus.ACTIVE} and refund_source.transaction_type = ${CreditTransactionType.CONSUME})`;
    const statements = items.map(
      (item: { creditId: string; creditsConsumed: number }) =>
        tx
          .update(credit)
          .set({
            remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
          })
          .where(and(eq(credit.id, item.creditId), eligible))
    );
    statements.push(
      tx
        .update(credit)
        .set({ status: CreditStatus.DELETED })
        .where(
          and(
            eq(credit.id, consumeCreditId),
            eq(credit.status, CreditStatus.ACTIVE)
          )
        )
    );
    if (batch) await tx.batch(statements);
    else for (const statement of statements) await statement;
  };
  if (envConfigs.database_provider === 'd1') await apply(db(), true);
  else await db().transaction((tx: any) => apply(tx));
}

// One standard-quality trial, only for a verified Google-created account.
export async function grantGoogleTrial(params: {
  userId: string;
  userEmail: string;
  providerId: string;
  emailVerified: boolean;
  isNewRegistration: boolean;
  configs: Record<string, string>;
}) {
  if (!isGoogleTrialEligible(params)) return;
  const credits = resolveTierCredits(params.configs, 'standard');
  const id = `google-trial:${params.userId}`;
  // Deterministic unique key makes hook retries harmless, including after spending.
  await db()
    .insert(credit)
    .values({
      id,
      userId: params.userId,
      userEmail: params.userEmail,
      transactionNo: id,
      transactionType: CreditTransactionType.GRANT,
      transactionScene: CreditTransactionScene.GIFT,
      credits,
      remainingCredits: credits,
      status: CreditStatus.ACTIVE,
      description: 'Google signup: one standard-quality generation',
      expiresAt: null,
    })
    .onConflictDoUpdate({ target: credit.id, set: { id } });
}

// --- History ---

export async function getHistory(userId: string, limit = 50) {
  return db()
    .select()
    .from(credit)
    .where(and(eq(credit.userId, userId), isNull(credit.deletedAt)))
    .orderBy(desc(credit.createdAt))
    .limit(limit);
}
