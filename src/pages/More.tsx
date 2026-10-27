import { Scale, BookOpen, ShoppingCart, Activity, Moon, BarChart3, ClipboardCheck, User, Database, Sun, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../db/hooks';
import { PageHeader, Segmented } from '../components/ui';

const LINKS = [
  { to: '/poids', label: 'Poids', icon: Scale, hint: 'Pesées, tendance, estimation' },
  { to: '/recettes', label: 'Recettes', icon: BookOpen, hint: '16 recettes + les tiennes' },
  { to: '/courses', label: 'Courses', icon: ShoppingCart, hint: 'Liste calculée sur le programme' },
  { to: '/activite', label: 'Activité quotidienne', icon: Activity, hint: 'Pas, distance, dépense' },
  { to: '/sommeil', label: 'Sommeil', icon: Moon, hint: 'Depuis Apple Santé ou saisie' },
  { to: '/stats', label: 'Statistiques', icon: BarChart3, hint: 'Graphiques et comparaisons' },
  { to: '/bilan', label: 'Bilans', icon: ClipboardCheck, hint: 'Jour et semaine' },
  { to: '/profil', label: 'Profil et objectifs', icon: User, hint: 'Données personnelles, calories, macros' },
  { to: '/donnees', label: 'Données', icon: Database, hint: 'Apple Santé, sauvegarde, export' },
];

export function applyTheme(theme: 'system' | 'light' | 'dark') {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0c0e' : '#f6f6f3');
  try { localStorage.setItem('ft88-theme', theme); } catch { /* préférence non conservée */ }
}

export default function MorePage() {
  const [profile, update] = useProfile();
  useEffect(() => { if (profile) applyTheme(profile.theme); }, [profile]);
  return (
    <div className="space-y-4 fade-in">
      <PageHeader title="Plus" />
      <nav className="card p-1" aria-label="Autres pages">
        <ul className="divide-y divide-line/50">
          {LINKS.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface2">
                <span className="w-9 h-9 rounded-xl bg-surface2 flex items-center justify-center text-accent"><l.icon size={18} /></span>
                <span className="flex-1 min-w-0"><span className="block font-semibold text-[15px]">{l.label}</span><span className="block text-[12px] text-muted">{l.hint}</span></span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {profile && (
        <div className="card flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-semibold text-[15px]"><Sun size={18} />Apparence</span>
          <Segmented ariaLabel="Thème" value={profile.theme} onChange={(t) => update({ theme: t })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} />
        </div>
      )}
      <p className="text-[12px] text-muted text-center">FITTRACK 88 · v0.1 · données stockées uniquement sur cet appareil</p>
    </div>
  );
}
