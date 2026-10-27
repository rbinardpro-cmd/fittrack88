import { Home, NotebookPen, UtensilsCrossed, Footprints, LayoutGrid } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from './toast';

const TABS = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/journal', label: 'Journal', icon: NotebookPen },
  { to: '/programme', label: 'Repas', icon: UtensilsCrossed },
  { to: '/course', label: 'Course', icon: Footprints },
  { to: '/plus', label: 'Plus', icon: LayoutGrid },
];

export function Layout() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 btn-secondary z-50">Aller au contenu</a>
      <div className="md:flex md:max-w-6xl md:mx-auto">
        {/* Barre latérale sur ordinateur / tablette */}
        <nav className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:sticky md:top-0 md:h-dvh md:py-6 md:pr-4 md:pl-4 gap-1" aria-label="Navigation principale">
          <div className="text-lg font-black tracking-tight mb-4 px-3">FITTRACK <span className="text-accent">88</span></div>
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] font-semibold ${isActive ? 'bg-surface text-ink border border-line/70' : 'text-muted hover:bg-surface2'}`}>
              <t.icon size={20} /> {t.label}
            </NavLink>
          ))}
        </nav>
        <main id="main" className="flex-1 min-w-0 px-4 pb-28 md:pb-10 pt-safe max-w-3xl mx-auto w-full">
          {import.meta.env.VITE_DEMO_BANNER && (
            <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-[12px] leading-relaxed">
              Aperçu à essayer : ici, la sauvegarde, les exports, le presse-papiers, l’installation sur l’écran d’accueil et Open Food Facts sont bloqués par l’hébergement. Les données saisies restent dans ce navigateur mais ne pourront pas être transférées : pour l’usage au quotidien, utilise la version installée.
            </div>
          )}
          <Outlet />
        </main>
      </div>
      {/* Barre d'onglets en bas sur mobile : atteignable au pouce */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-line/70 pb-safe" aria-label="Navigation principale">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold ${isActive ? 'text-accent' : 'text-muted'}`}>
              <t.icon size={22} strokeWidth={2} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster />
    </div>
  );
}
