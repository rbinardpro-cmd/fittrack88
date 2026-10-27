import { BarcodeDetector as ZxingDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { PRODUCT_FORMATS } from './barcode-utils';

export { normalizeBarcode } from './barcode-utils';

/*
 * Lecture des codes-barres produits (EAN-13, EAN-8, UPC).
 * Safari (iPhone) n'a pas de lecteur intégré : on utilise ZXing compilé en WebAssembly,
 * servi par l'appli elle-même (aucun service externe, fonctionne hors ligne).
 * L'image de la caméra est analysée sur l'appareil et n'est jamais envoyée.
 */

type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string; format: string }[]> };

let detectorPromise: Promise<Detector> | null = null;

/** Lecteur natif quand il existe (Chrome Android, macOS), sinon ZXing local. */
export function getDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
      if (Native) {
        try {
          const supported = await Native.getSupportedFormats();
          if (PRODUCT_FORMATS.every((f) => supported.includes(f))) return new Native({ formats: [...PRODUCT_FORMATS] });
        } catch { /* on passe à ZXing */ }
      }
      prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
      return new ZxingDetector({ formats: [...PRODUCT_FORMATS] });
    })();
  }
  return detectorPromise;
}
