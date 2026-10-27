/*
 * Code de verrouillage de l'appli (4 à 6 chiffres), propre à chaque appareil.
 * On ne garde qu'une empreinte PBKDF2-SHA-256 salée, jamais le code lui-même.
 * C'est un verrou d'accès à l'écran, pas un chiffrement : il empêche d'ouvrir l'appli
 * sur un téléphone prêté ou laissé déverrouillé, mais les données restent lisibles
 * par quelqu'un qui a un accès technique au navigateur de l'appareil.
 */

export interface PinLock {
  salt: string;
  hash: string;
  iterations: number;
  /** Nombre de chiffres, pour valider dès la saisie du dernier. */
  length: number;
}

export const PIN_ITERATIONS = 150_000;

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toHex(bits);
}

export async function createPinLock(pin: string, iterations = PIN_ITERATIONS): Promise<PinLock> {
  if (!isValidPin(pin)) throw new Error('Le code doit comporter 4 à 6 chiffres.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: await derive(pin, salt, iterations), iterations, length: pin.length };
}

export async function verifyPin(lock: PinLock, pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const h = await derive(pin, fromHex(lock.salt), lock.iterations);
  // comparaison à temps constant
  let diff = h.length ^ lock.hash.length;
  for (let i = 0; i < h.length && i < lock.hash.length; i++) diff |= h.charCodeAt(i) ^ lock.hash.charCodeAt(i);
  return diff === 0;
}

/** Attente imposée après des erreurs : 5 essais libres, puis 30 s, 1 min, 2 min… (max 15 min). */
export function lockoutMs(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(30_000 * 2 ** (failures - 5), 15 * 60_000);
}
