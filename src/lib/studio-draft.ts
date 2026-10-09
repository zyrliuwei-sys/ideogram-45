import type { AspectRatio, IdeogramTier } from '@/config/ideogram';

export type StudioDraft = {
  prompt: string;
  mode: 'generate' | 'edit';
  tier: IdeogramTier;
  aspect: AspectRatio;
  expand: boolean;
  lockOn: boolean;
  source: { png: string; upload: string; width: number; height: number } | null;
  mask: string | null;
};

let saver: (() => Promise<void>) | undefined;
export function registerStudioDraftSaver(fn: () => Promise<void>) {
  saver = fn;
  return () => {
    if (saver === fn) saver = undefined;
  };
}
export async function flushStudioDraft() {
  await saver?.();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ig45-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readStudioDraft(): Promise<StudioDraft | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('drafts', 'readonly');
      const request = transaction.objectStore('drafts').get('current');
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
// Serialize writes so an older autosave cannot overwrite the navigation flush.
let pending: Promise<void> = Promise.resolve();
export function writeStudioDraft(draft: StudioDraft): Promise<void> {
  pending = pending
    .catch(() => {})
    .then(async () => {
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction('drafts', 'readwrite');
          transaction.objectStore('drafts').put(draft, 'current');
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
    });
  return pending;
}
