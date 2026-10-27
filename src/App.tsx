import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { useProfile, useStore } from './db/hooks';
import { requestPersistence } from './db/db';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import { applyTheme } from './pages/More';

const WeightPage = lazy(() => import('./pages/Weight'));
const MealPlan = lazy(() => import('./pages/MealPlan'));
const Recipes = lazy(() => import('./pages/Recipes'));
const RecipeDetail = lazy(() => import('./pages/Recipes').then((m) => ({ default: m.RecipeDetail })));
const Shopping = lazy(() => import('./pages/Shopping'));
const Running = lazy(() => import('./pages/Running'));
const SessionDetail = lazy(() => import('./pages/Running').then((m) => ({ default: m.SessionDetail })));
const WorkoutForm = lazy(() => import('./pages/Running').then((m) => ({ default: m.WorkoutForm })));
const Activity = lazy(() => import('./pages/Activity'));
const Stats = lazy(() => import('./pages/Stats'));
const Review = lazy(() => import('./pages/Review'));
const Profile = lazy(() => import('./pages/Profile'));
const Data = lazy(() => import('./pages/Data'));
const More = lazy(() => import('./pages/More'));
const Welcome = lazy(() => import('./pages/Welcome'));

function ThemeSync() {
  const [profile] = useProfile();
  useEffect(() => {
    if (!profile) return;
    applyTheme(profile.theme);
    if (profile.theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [profile]);
  return null;
}

export default function App() {
  useEffect(() => { requestPersistence(); }, []);
  const profiles = useStore('profile');
  if (!profiles) return <Loading />;
  // Premier lancement sur cet appareil : création du profil (ou restauration d'une sauvegarde).
  if (profiles.length === 0) return <Suspense fallback={<Loading />}><Welcome /></Suspense>;
  return (
    <HashRouter>
      <ThemeSync />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="journal" element={<Journal />} />
            <Route path="poids" element={<WeightPage />} />
            <Route path="programme" element={<MealPlan />} />
            <Route path="recettes" element={<Recipes />} />
            <Route path="recettes/:id" element={<RecipeDetail />} />
            <Route path="courses" element={<Shopping />} />
            <Route path="course" element={<Running />} />
            <Route path="course/seance/:id" element={<SessionDetail />} />
            <Route path="course/saisie" element={<WorkoutForm />} />
            <Route path="activite" element={<Activity />} />
            <Route path="sommeil" element={<Activity focus="sleep" />} />
            <Route path="stats" element={<Stats />} />
            <Route path="bilan" element={<Review />} />
            <Route path="profil" element={<Profile />} />
            <Route path="donnees" element={<Data />} />
            <Route path="plus" element={<More />} />
            <Route path="*" element={<div className="py-16 text-center text-muted">Page introuvable.</div>} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
