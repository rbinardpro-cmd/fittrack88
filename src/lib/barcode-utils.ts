/* Fonctions pures sur les codes-barres GS1 (sans dépendance au lecteur). */

export const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

/** Vérifie la clé de contrôle GS1 (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Développe un UPC-E (8 chiffres) en UPC-A, forme utilisée par Open Food Facts. */
export function upcEtoA(upce: string): string {
  if (!/^[01]\d{7}$/.test(upce)) return upce;
  const [ns, d1, d2, d3, d4, d5, d6, check] = upce.split('');
  let body: string;
  if ('012'.includes(d6)) body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${ns}${body}${check}`;
}

/** Normalise un code lu : UPC-E développé, codes invalides écartés. */
export function normalizeBarcode(raw: string, format?: string): string | null {
  const code = raw.replace(/\D/g, '');
  const full = format === 'upc_e' ? upcEtoA(code) : code;
  return isValidGtin(full) ? full : null;
}

/** Variantes à essayer dans Open Food Facts (un UPC-A y est souvent rangé en EAN-13 avec un 0 devant). */
export function barcodeVariants(code: string): string[] {
  const v = [code];
  if (code.length === 12) v.push(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) v.push(code.slice(1));
  return v;
}
