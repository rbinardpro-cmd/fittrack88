/// <reference lib="webworker" />
import { Unzip, UnzipInflate } from 'fflate';
import { HealthExportScanner } from '../lib/healthImport';

/*
 * Lecture de l'export Apple Santé dans un Worker (l'interface reste fluide).
 * Accepte export.zip (décompressé à la volée) ou export.xml. Rien ne sort de l'appareil.
 */

export type WorkerIn = { file: File; from?: string; importWeights: boolean };
export type WorkerOut =
  | { type: 'progress'; read: number; total: number }
  | { type: 'done'; result: ReturnType<HealthExportScanner['finish']> }
  | { type: 'error'; message: string };

const post = (m: WorkerOut) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { file, from, importWeights } = e.data;
  try {
    const scanner = new HealthExportScanner({ from, importWeights });
    const decoder = new TextDecoder('utf-8');
    const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');
    let found = !isZip;
    let unzip: Unzip | null = null;
    let fileError: Error | null = null;
    if (isZip) {
      unzip = new Unzip();
      unzip.register(UnzipInflate);
      unzip.onfile = (f) => {
        // export.xml uniquement (pas export_cda.xml ni les tracés GPS)
        if (!/(^|\/)export\.xml$/.test(f.name)) return;
        found = true;
        f.ondata = (err, chunk, final) => {
          if (err) { fileError = err; return; }
          scanner.push(decoder.decode(chunk, { stream: !final }));
        };
        f.start();
      };
    }
    const reader = file.stream().getReader();
    let read = 0;
    let lastPost = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        unzip?.push(new Uint8Array(0), true);
        break;
      }
      read += value.byteLength;
      if (unzip) unzip.push(value, false);
      else scanner.push(decoder.decode(value, { stream: true }));
      if (fileError) throw fileError;
      if (read - lastPost > 4_000_000) {
        lastPost = read;
        post({ type: 'progress', read, total: file.size });
      }
    }
    if (!isZip) scanner.push(decoder.decode());
    if (!found) throw new Error('Le fichier zip ne contient pas « export.xml ». Utilise le fichier « export.zip » créé par l’app Santé.');
    post({ type: 'done', result: scanner.finish() });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
