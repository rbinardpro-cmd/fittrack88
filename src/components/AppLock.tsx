import { KeyRound, Lock, LockOpen } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { deleteAllData } from '../db/backup';
import { createPinLock, isValidPin, lockoutMs, verifyPin, type PinLock } from '../lib/pin';
import { Card, Field, Notice, Sheet } from './ui';
import { toast } from './toast';

/*
 * Verrouillage optionnel par code. Le code est propre à cet appareil (stocké hors sauvegarde) :
 * restaurer une sauvegarde sur un autre téléphone ne transporte pas le code.
 */

const LOCK_KEY = 'ft88-lock';
const FAILS_KEY = 'ft88-lock-fails';
const SESSION_KEY = 'ft88-unlocked';
/** Délai en arrière-plan au-delà duquel le code est redemandé. */
const RELOCK_AFTER_MS = 5 * 60_000;

function readLock(): PinLock | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    return raw ? (JSON.parse(raw) as PinLock) : null;
  } catch {
    return null;
  }
}
function writeLock(lock: PinLock | null) {
  if (lock) localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  else localStorage.removeItem(LOCK_KEY);
}
function readFails(): { n: number; at: number } {
  try {
    return JSON.parse(localStorage.getItem(FAILS_KEY) || '') as { n: number; at: number };
  } catch {
    return { n: 0, at: 0 };
  }
}
function writeFails(f: { n: number; at: number }) {
  try { localStorage.setItem(FAILS_KEY, JSON.stringify(f)); } catch { /* rien */ }
}
function sessionUnlocked(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function setSessionUnlocked(v: boolean) {
  try {
    if (v) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* rien */ }
}

let relock: (() => void) | null = null;
/** Verrouille immédiatement (bouton « Verrouiller maintenant »). */
export function lockNow() {
  setSessionUnlocked(false);
  relock?.();
}

export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => !!readLock() && !sessionUnlocked());
  useEffect(() => {
    relock = () => readLock() && setLocked(true);
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS && readLock()) {
        setSessionUnlocked(false);
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      relock = null;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  if (locked) return <LockScreen onUnlock={() => { setSessionUnlocked(true); setLocked(false); }} />;
  return <>{children}</>;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const lock = readLock()!;
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fails = readFails();
  const waitMs = Math.max(0, fails.at + lockoutMs(fails.n) - now);

  useEffect(() => {
    if (!waitMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waitMs]);

  async function check(value: string) {
    if (busy || waitMs) return;
    setBusy(true);
    const ok = await verifyPin(lock, value);
    setBusy(false);
    if (ok) {
      writeFails({ n: 0, at: 0 });
      onUnlock();
      return;
    }
    const f = { n: readFails().n + 1, at: Date.now() };
    writeFails(f);
    setNow(Date.now());
    setPin('');
    setError(lockoutMs(f.n) ? `Code incorrect. Trop d’essais : patiente avant de réessayer.` : `Code incorrect (${f.n} essai${f.n > 1 ? 's' : ''}).`);
    input.current?.focus();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-xs text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/15 text-accent flex items-center justify-center"><Lock size={26} /></div>
        <h1 className="text-xl font-bold">FITTRACK 88</h1>
        <p className="text-sm text-muted">Entre ton code pour ouvrir l’appli.</p>
        <form onSubmit={(e) => { e.preventDefault(); check(pin); }}>
          <input
            ref={input}
            className="input text-center text-2xl tracking-[0.5em] tabular"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoFocus
            maxLength={6}
            aria-label="Code de verrouillage"
            value={pin}
            disabled={!!waitMs}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPin(v);
              setError(null);
              if (v.length === lock.length) check(v);
            }}
          />
          <button className="btn-primary w-full mt-3" disabled={busy || !!waitMs || !isValidPin(pin)}>{busy ? 'Vérification…' : 'Déverrouiller'}</button>
        </form>
        {waitMs > 0 && <p className="text-sm text-muted" role="status">Nouvel essai possible dans {Math.ceil(waitMs / 1000)} s.</p>}
        {error && !waitMs && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        <button className="text-sm text-accent font-semibold" onClick={() => setForgot(true)}>Code oublié ?</button>
      </div>
      <ForgotSheet open={forgot} onClose={() => setForgot(false)} />
    </main>
  );
}

function ForgotSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Code oublié">
      <div className="space-y-3 text-left">
        <p className="text-[14px]">Le code n’est enregistré nulle part en clair : personne ne peut le retrouver. La seule solution est d’effacer toutes les données de l’appli sur ce téléphone, puis de repartir de zéro ou de restaurer une sauvegarde.</p>
        <Field label="Tape EFFACER pour confirmer"><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" /></Field>
        <button className="btn-danger w-full" disabled={typed.trim().toUpperCase() !== 'EFFACER'} onClick={async () => {
          await deleteAllData();
          try { localStorage.clear(); sessionStorage.clear(); } catch { /* rien */ }
          location.reload();
        }}>Effacer toutes les données de ce téléphone</button>
      </div>
    </Sheet>
  );
}

/** Réglage du code (page Plus). */
export function LockSettings() {
  const [lock, setLock] = useState(readLock);
  const [mode, setMode] = useState<null | 'set' | 'change' | 'remove'>(null);
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => { setMode(null); setCurrent(''); setPin(''); setConfirm(''); setError(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode !== 'set' && !(await verifyPin(lock!, current))) { setError('Code actuel incorrect.'); return; }
    if (mode === 'remove') {
      writeLock(null);
      setLock(null);
      toast('Code supprimé');
      close();
      return;
    }
    if (!isValidPin(pin)) { setError('Le code doit comporter 4 à 6 chiffres.'); return; }
    if (pin !== confirm) { setError('Les deux codes ne sont pas identiques.'); return; }
    setBusy(true);
    try {
      const next = await createPinLock(pin);
      writeLock(next);
      setSessionUnlocked(true);
      setLock(next);
      toast(mode === 'set' ? 'Code activé' : 'Code modifié');
      close();
    } catch {
      setError('Impossible d’enregistrer le code sur cet appareil.');
    } finally {
      setBusy(false);
    }
  }

  const digits = (label: string, v: string, set: (s: string) => void, auto = false) => (
    <Field label={label}>
      <input className="input tabular tracking-widest" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={6} autoFocus={auto} value={v} onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </Field>
  );

  return (
    <Card title="Code de verrouillage">
      <p className="text-[13px] text-muted">
        {lock ? 'Activé : le code est demandé à chaque ouverture et après 5 minutes en arrière-plan.' : 'Désactivé. Un code à 4–6 chiffres empêche d’ouvrir l’appli si quelqu’un prend ton téléphone déverrouillé.'}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {!lock && <button className="btn-primary btn-sm" onClick={() => setMode('set')}><KeyRound size={16} />Activer un code</button>}
        {lock && <button className="btn-secondary btn-sm" onClick={() => lockNow()}><Lock size={16} />Verrouiller maintenant</button>}
        {lock && <button className="btn-secondary btn-sm" onClick={() => setMode('change')}><KeyRound size={16} />Changer</button>}
        {lock && <button className="btn-ghost btn-sm" onClick={() => setMode('remove')}><LockOpen size={16} />Supprimer</button>}
      </div>
      <p className="text-[12px] text-muted mt-3">C’est un verrou d’écran, pas un chiffrement : il protège contre un regard indiscret, pas contre un accès technique au téléphone. Le code reste sur cet appareil et n’est pas inclus dans les sauvegardes. En cas d’oubli, il faut effacer les données de l’appli (garde une sauvegarde à jour).</p>
      <Sheet open={!!mode} onClose={close} title={mode === 'set' ? 'Activer un code' : mode === 'change' ? 'Changer le code' : 'Supprimer le code'}>
        <form className="space-y-3" onSubmit={submit}>
          {mode !== 'set' && digits('Code actuel', current, setCurrent, true)}
          {mode !== 'remove' && digits('Nouveau code (4 à 6 chiffres)', pin, setPin, mode === 'set')}
          {mode !== 'remove' && digits('Confirme le nouveau code', confirm, setConfirm)}
          {error && <Notice tone="warn">{error}</Notice>}
          <button className={mode === 'remove' ? 'btn-danger w-full' : 'btn-primary w-full'} disabled={busy}>{mode === 'remove' ? 'Supprimer le code' : 'Enregistrer'}</button>
        </form>
      </Sheet>
    </Card>
  );
}
