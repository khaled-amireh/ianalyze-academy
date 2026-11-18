// Only AES-GCM ciphertext is persisted in the browser. The per-user key is
// fetched through an owner-checked RPC and remains in memory for this form.
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ianalyze-private-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export async function cacheKey(hex: string) {
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(hex.match(/../g)!.map((value) => parseInt(value, 16))),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}
async function entry(id: string, write?: unknown) {
  const database = await db();
  return new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(
      'drafts',
      write === undefined ? 'readonly' : 'readwrite',
    );
    const store = transaction.objectStore('drafts');
    const request = write === undefined ? store.get(id) : store.put(write, id);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
export async function writeCache(id: string, key: CryptoKey, payload: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  await entry(id, { iv, cipher });
}
export async function readCache(id: string, key: CryptoKey) {
  const value = (await entry(id)) as { iv: Uint8Array; cipher: ArrayBuffer } | undefined;
  if (!value) return null;
  try {
    return JSON.parse(
      new TextDecoder().decode(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(value.iv),
            additionalData: new TextEncoder().encode(id),
          },
          key,
          value.cipher,
        ),
      ),
    );
  } catch {
    return null;
  }
}
