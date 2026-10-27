# FITTRACK 88

Application personnelle de suivi du poids, de la nutrition, des repas, des courses, de la course à pied et des données Apple Watch. **100 % gratuite, sans compte, sans serveur** : les données restent dans le navigateur de l'appareil.

Architecture détaillée, modèle de données et étude de faisabilité Apple Santé : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Installation

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent (gratuit).

```bash
npm install
```

## Lancement

```bash
npm run dev        # développement : http://localhost:5173
npm run build      # version optimisée dans dist/
npm run preview    # sert dist/ : http://localhost:4173
```

Pour l'ouvrir depuis l'iPhone sur le même Wi-Fi : `npm run dev -- --host`, puis ouvre l'adresse « Network » affichée dans Safari. Attention : l'installation sur l'écran d'accueil et le mode hors ligne exigent HTTPS, donc une version hébergée (voir Déploiement).

## Configuration et variables d'environnement

**Aucune.** Pas de clé API, pas de secret, pas de fichier `.env`. Tous les réglages (profil, objectifs, eau, pas, dates de programme, nombre de personnes, thème) se font dans l'application, page **Profil** et **Plus**.

## Installer sur l'iPhone (PWA)

1. Ouvre l'adresse de l'application dans **Safari**.
2. Bouton Partager › **Sur l'écran d'accueil**.
3. Utilise **toujours l'icône** : l'app installée et Safari ont des stockages séparés sur iOS.

## Déploiement gratuit

L'application est un site statique (`dist/`), utilisable dans un sous-dossier grâce au routage par `#`.

- **GitHub Pages (recommandé)** : crée un dépôt **public** (Pages est gratuit pour les dépôts publics ; ce n'est que le code, jamais tes données), pousse le projet, puis dans *Settings › Pages › Source* choisis **GitHub Actions**. Le workflow `.github/workflows/deploy.yml` lance les tests, construit et publie à chaque push sur `main`. Adresse : `https://<ton-compte>.github.io/<dépôt>/`.
- **Cloudflare Pages** (alternative gratuite) : commande de build `npm run build`, dossier `dist`.
- Domaine personnalisé : payant (≈ 10 €/an), donc non nécessaire.

## Utilisation quotidienne

- **Premier lancement** : chaque téléphone affiche un écran d'accueil (prénom, sexe, âge, taille, poids, objectif, activité) ou propose de restaurer une sauvegarde. Les données de chaque appareil sont séparées : deux personnes = deux téléphones = deux suivis indépendants, sans compte ni serveur.
- **Scan de code-barres** (Journal › ajouter › Scanner) : caméra arrière en direct, photo de l'étiquette ou saisie des chiffres (clé de contrôle vérifiée). Lecture sur l'appareil avec ZXing en WebAssembly (aucun service externe) ; le code est cherché d'abord dans les aliments déjà enregistrés, puis dans Open Food Facts ; produit absent ou incomplet → création depuis l'étiquette, reconnue au scan suivant.
- **Code de verrouillage** (Plus) : 4 à 6 chiffres, demandé à l'ouverture et après 5 min en arrière-plan, attente croissante après 5 erreurs. Seule une empreinte PBKDF2 salée est stockée. C'est un verrou d'écran, pas un chiffrement ; il n'est pas inclus dans les sauvegardes ; en cas d'oubli, il faut effacer les données de l'appli sur ce téléphone.
- **Accueil** : progression (avancement vers 88 kg, kg perdus/restants, variations 7/30/90 jours, moyenne hebdo, estimation datée avec fourchette après 14 jours), journée (calories, macros, eau, énergie, activité, entraînement, habitudes).
- **Journal** : aliments par repas, cru/cuit, recettes en portions (½, 1, 1½…), ajout rapide, dupliquer un repas, reprendre un repas précédent, eau (+250, +500, personnalisé).
- **Repas** : programme 14 jours ; « Mangé » ajoute la recette au journal (et seulement à ce moment), « Remplacé » ouvre le journal, « Ignoré » retire le repas des courses.
- **Course** : programme de reprise modifiable, calendrier avec repos, minuteur d'intervalles, saisie complète, historique et graphiques. La progression n'est jamais automatique.
- **Plus › Données** : import Apple Santé, import JSON/CSV, sauvegarde/restauration, exports CSV, suppression.

### Comment sont faits les calculs
- Métabolisme de base : Mifflin-St Jeor. Dépense : × facteur d'activité (1,2 à 1,725).
- Objectif : dépense − déficit (500 kcal par défaut, borné à 750 kcal et 25 % de la dépense, jamais sous le métabolisme de base). Protéines 1,8 g/kg de poids objectif, lipides 30 %, glucides le reste, fibres 14 g/1000 kcal.
- Avancement : (départ − actuel) / (départ − objectif). 120 → 110 kg pour 88 kg = 31,25 % (à ne pas confondre avec 8,3 % du poids perdu).
- Prévision : régression linéaire sur 6 semaines, au moins 14 jours et 5 pesées ; fourchette ± 1,28 erreur type et ralentissement de 25 % côté pessimiste.
- Ajustement : proposé (jamais appliqué seul) après 3 semaines et 80 % de jours notés, ±150 kcal maximum.
- Dépense du jour : repos + actives si Apple Santé fournit les deux, sinon estimation (qui inclut déjà l'activité : les calories actives ne sont pas ajoutées deux fois). L'objectif alimentaire n'augmente pas avec le sport.
- Cru/cuit : valeurs cuites = valeurs crues ÷ rendement (pâtes ×2,3, riz ×2,6, lentilles ×2,5, viandes ×0,72 à 0,8).

## Apple Santé / Apple Watch Ultra

Une page web **ne peut pas** lire Apple Santé (aucune API dans Safari). Trois moyens gratuits :

1. **Export complet** : app Santé › photo de profil › *Exporter toutes les données de santé* › *Enregistrer dans Fichiers*, puis FITTRACK 88 › Plus › Données › *Choisir export.zip*. Lecture locale, ré-import sans doublons.
2. **Raccourci iOS + import JSON** (résumé quotidien, sans exporter tout l'historique). Format attendu :

   ```json
   {
     "fittrack": 1,
     "days": [{ "date": "2026-10-27", "steps": 8500, "distanceKm": 6.1, "activeKcal": 520,
                "basalKcal": 2150, "exerciseMin": 35, "sleepMin": 410, "restingHr": 62 }],
     "workouts": [{ "date": "2026-10-27", "startTime": "18:05", "type": "course", "durationMin": 28,
                    "distanceKm": 3.2, "avgHr": 142, "maxHr": 165, "activeKcal": 310, "elevationM": 18 }],
     "weights": [{ "date": "2026-10-27", "kg": 118.4 }]
   }
   ```
   Tous les champs sont facultatifs sauf `date` (et `durationMin` pour une séance). Construction suggérée du Raccourci (**non testée sur iPhone** : à créer dans l'app Raccourcis) : pour chaque mesure, action *Rechercher des échantillons de santé* (type : Nombre de pas, Distance marche et course, Énergie active, Énergie au repos, Minutes d'exercice ; date : aujourd'hui ; regrouper par jour) ; action *Texte* qui assemble le JSON ci-dessus avec les résultats et la *Date actuelle* au format `yyyy-MM-dd` ; action *Copier dans le presse-papiers*. Ensuite, dans FITTRACK 88 › Données › *Coller et importer*.
3. **Saisie manuelle** de toutes les valeurs.

Une app native HealthKit demanderait un Mac + Xcode ; sans le programme développeur payant (99 $/an), elle doit être réinstallée tous les 7 jours : non retenue (voir ARCHITECTURE.md § 5).

## Sauvegarde et transfert vers un autre appareil

Plus › Données › **Sauvegarder** crée `fittrack88-sauvegarde-AAAA-MM-JJ.json`. Range-le dans iCloud Drive ou Fichiers. Sur l'autre appareil : **Restaurer** (remplace les données de cet appareil). Il n'y a pas de synchronisation automatique : décide d'un appareil « principal » pour la saisie.

## Structure du projet

```
src/
  lib/          calculs purs, testés : energy, weight, nutrition, recipes, shopping, running,
                summary, dates, healthImport (lecteur export Apple Santé), off (Open Food Facts), csv
  data/         base d'aliments, 16 recettes + collations, programme 14 jours
  db/           IndexedDB (db), hooks React, actions, importer, sauvegarde (backup)
  workers/      healthWorker : lecture d'export.zip en arrière-plan
  components/   UI réutilisable, graphiques, ajout d'aliment, minuteur
  pages/        une page par écran
tests/          tests Vitest des calculs et imports
docs/           architecture et faisabilité
```

## Tests

```bash
npm test           # 75 tests, fuseau Europe/Paris forcé
npm run typecheck
```

Couvert : Mifflin-St Jeor, objectifs et bornes, absence de double comptage, ajustement prudent, progression (exemple 31,25 %), moyennes glissantes, prévision (refus avec une semaine de données, fourchette), cru/cuit, cohérence de la base (calories = macros), recettes et portions (½, 1½), allergènes, absence de porc, programme 14 jours (transportable, variété, 80-100 % de l'objectif), courses (prorata, pièces, placard, budget), durées exactes des séances, allure/vitesse, tolérance (douleur, effort), dates (changements d'heure, minuit, années bissextiles), import Apple Santé (déduplication iPhone/Watch, kJ→kcal, sommeil fusionné, séances ancien et nouveau format, découpage du flux), JSON, CSV, Open Food Facts.

Vérifié en plus dans Chromium au format iPhone 13 (Playwright) : pesée, journal (250 g de pâtes cuites = 385 kcal), eau, repas « mangé » en 1,5 portion, séance, persistance après rechargement, import d'un export.zip, ré-import sans doublon, sauvegarde → suppression → restauration, export CSV, rechargement hors ligne, mode clair/sombre, affichage ordinateur. **Non vérifié sur un vrai iPhone/Safari** ni avec un vrai export Apple Santé volumineux.

## Confidentialité

Aucun compte, aucun serveur, aucun traceur. Les données (poids, repas, activité, sommeil) sont dans IndexedDB sur l'appareil. Seule connexion externe : Open Food Facts, à ta demande (le texte recherché ou les chiffres du code-barres sont envoyés ; l'image de la caméra ne quitte jamais le téléphone). Export, restauration et suppression totale disponibles dans Données.

## Licence des données

Open Food Facts : ODbL. Valeurs de la base locale : moyennes d'après CIQUAL (ANSES, Licence Ouverte), saisies manuellement, à vérifier.
