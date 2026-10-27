import { describe, expect, it } from 'vitest';
import { barcodeVariants, isValidGtin, normalizeBarcode, upcEtoA } from '../src/lib/barcode-utils';
import { createPinLock, isValidPin, lockoutMs, verifyPin } from '../src/lib/pin';

describe('codes-barres', () => {
  it('vérifie la clé de contrôle', () => {
    expect(isValidGtin('3017620422003')).toBe(true); // EAN-13
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true); // EAN-8
    expect(isValidGtin('036000291452')).toBe(true); // UPC-A
    expect(isValidGtin('12345')).toBe(false);
  });
  it('développe un UPC-E en UPC-A', () => {
    expect(upcEtoA('04252614')).toBe('042100005264');
    expect(normalizeBarcode('04252614', 'upc_e')).toBe('042100005264');
  });
  it('nettoie la saisie et rejette un code mal recopié', () => {
    expect(normalizeBarcode(' 3 017620 422003 ')).toBe('3017620422003');
    expect(normalizeBarcode('3017620422004')).toBeNull();
  });
  it('propose la variante EAN-13 d’un UPC-A', () => {
    expect(barcodeVariants('036000291452')).toEqual(['036000291452', '0036000291452']);
    expect(barcodeVariants('0036000291452')).toEqual(['0036000291452', '036000291452']);
  });
});

describe('code de verrouillage', () => {
  it('accepte 4 à 6 chiffres seulement', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
  it('ne stocke pas le code et le vérifie', async () => {
    const lock = await createPinLock('2580', 1000);
    expect(JSON.stringify(lock)).not.toContain('2580');
    expect(lock.length).toBe(4);
    expect(await verifyPin(lock, '2580')).toBe(true);
    expect(await verifyPin(lock, '2581')).toBe(false);
    const other = await createPinLock('2580', 1000);
    expect(other.hash).not.toBe(lock.hash); // sel différent
  });
  it('impose une attente croissante après 5 erreurs', () => {
    expect(lockoutMs(4)).toBe(0);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(20)).toBe(15 * 60_000);
  });
});
