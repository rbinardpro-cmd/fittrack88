import { z } from 'zod';
import { clearStore, getAll, getDB, notify, STORES, type StoreName } from './db';

/*
 * Sauvegarde complète : un fichier JSON contenant tous les magasins.
 * C'est aussi le moyen de transférer les données vers un autre appareil (pas de cloud).
 */

export const BACKUP_FORMAT = 'fittrack88-backup';
export const BACKUP_VERSION = 1;

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string(),
  data: z.record(z.array(z.record(z.unknown()))),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportBackup(): Promise<Backup> {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const s of STORES) data[s] = (await getAll(s)) as unknown as Record<string, unknown>[];
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function validateBackup(json: unknown): { ok: true; backup: Backup; counts: Record<string, number> } | { ok: false; error: string } {
  const r = backupSchema.safeParse(json);
  if (!r.success) return { ok: false, error: 'Fichier non reconnu : ce n’est pas une sauvegarde FITTRACK 88 valide.' };
  const unknownStores = Object.keys(r.data.data).filter((k) => !STORES.includes(k as StoreName));
  if (unknownStores.length) return { ok: false, error: `Sections inconnues : ${unknownStores.join(', ')}` };
  for (const [store, rows] of Object.entries(r.data.data)) {
    for (const row of rows) if (typeof row.id !== 'string') return { ok: false, error: `Entrée sans identifiant dans « ${store} ».` };
  }
  const counts = Object.fromEntries(Object.entries(r.data.data).map(([k, v]) => [k, v.length]));
  return { ok: true, backup: r.data, counts };
}

/** Restaure en remplaçant toutes les données actuelles (transaction unique : tout ou rien). */
export async function restoreBackup(backup: Backup): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const s of STORES) {
    const store = tx.objectStore(s);
    await store.clear();
    for (const row of backup.data[s] ?? []) await store.put(row as never);
  }
  await tx.done;
  STORES.forEach(notify);
}

export async function deleteAllData(): Promise<void> {
  for (const s of STORES) await clearStore(s);
}
