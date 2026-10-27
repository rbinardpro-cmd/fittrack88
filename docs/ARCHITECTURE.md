# FITTRACK 88 — Architecture et faisabilité

Ce document correspond à l'**étape 1** du cahier des charges : l'architecture retenue, les pages, le modèle de données, la stack, la faisabilité Apple Watch / Apple Santé et les limites. Contrainte prioritaire : **0 € pour développer et utiliser l'application**.

## 1. Architecture retenue

```
┌────────────────────────── Navigateur (Safari iPhone, Chrome/Safari ordinateur) ──────────────────────────┐
│  Application web (PWA) : React + TypeScript                                                               │
│   ├── Interface (pages, composants, graphiques Recharts)                                                  │
│   ├── Moteur de calcul pur (src/lib) : énergie, poids, prévision, cru/cuit, recettes, courses, séances     │
│   ├── Stockage local IndexedDB (src/db) : toutes les données personnelles                                  │
│   ├── Worker d'import Apple Santé (lecture en continu de export.zip, sur l'appareil)                       │
│   └── Service worker : fonctionnement hors ligne + installation sur l'écran d'accueil                       │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        ▲ fichier export.zip (app Santé)       ▲ JSON (Raccourci iOS)         ▲ recherche texte (optionnelle)
        │                                      │                               │
   Apple Santé ◄── Apple Watch Ultra       App Raccourcis                Open Food Facts (gratuit, sans clé)
```

**Pourquoi pas Next.js ni serveur ?** Un serveur implique un hébergement, une base distante, une authentification et la protection de données de santé : de la complexité et un risque de coût, pour un usage strictement personnel. Une application 100 % locale (Vite + React) est plus simple, gratuite, rapide, fonctionne hors ligne et ne transmet rien. Le prix à payer : pas de synchronisation automatique entre appareils (voir § 6).

## 2. Stack et coût

| Brique | Choix | Licence | Coût |
|---|---|---|---|
| Langage / UI | TypeScript, React 18 | MIT | 0 € |
| Outil de build | Vite 6 | MIT | 0 € |
| Design | Tailwind CSS 3, icônes Lucide | MIT / ISC | 0 € |
| Graphiques | Recharts 2 | MIT | 0 € |
| Stockage | IndexedDB via `idb` | ISC | 0 € |
| Décompression export.zip | `fflate` | MIT | 0 € |
| Validation des sauvegardes | `zod` | MIT | 0 € |
| PWA / hors ligne | `vite-plugin-pwa` (Workbox) | MIT | 0 € |
| Tests | Vitest, Playwright (vérification navigateur) | MIT / Apache-2.0 | 0 € |
| Données aliments en ligne | Open Food Facts | ODbL (données), API sans clé | 0 € |
| Hébergement (facultatif) | GitHub Pages ou Cloudflare Pages | offres gratuites | 0 € |

Aucune clé API, aucun secret, aucun service payant.

## 3. Pages

Accueil (tableau de bord) · Journal (aliments + eau) · Programme repas 14 jours · Recettes (+ détail, création) · Courses · Course à pied (programme, calendrier, historique, progression, détail de séance, minuteur, saisie) · Poids · Activité quotidienne · Sommeil · Statistiques · Bilans (jour / semaine) · Profil et objectifs · Données (import Apple Santé, import JSON/CSV, sauvegarde, restauration, export CSV, suppression) · Plus (menu, thème).

Navigation : barre d'onglets en bas sur iPhone (utilisable au pouce), barre latérale sur ordinateur et tablette. Les formulaires s'ouvrent dans des feuilles qui montent du bas de l'écran.

## 4. Modèle de données (IndexedDB, base `fittrack88`)

| Magasin | Clé | Contenu |
|---|---|---|
| `profile` | `profile` | âge, sexe, taille, poids de départ, objectif, niveau d'activité, déficit, objectifs manuels, eau, pas, dates de début des programmes, personnes, thème |
| `weights` | id | date (AAAA-MM-JJ locale), heure, kg, **source**, note |
| `foods` | id | aliments personnels et produits Open Food Facts conservés (valeurs /100 g, rendement de cuisson, portion, allergènes, **source**) |
| `foodPrefs` | id aliment | favoris, dernière utilisation (historique) |
| `logs` | id | journal : date, repas, aliment ou recette, grammes + état cru/cuit ou portions, **valeurs figées**, source |
| `water` | id | date, ml, heure |
| `planStates` | `date|repas` | statut du repas prévu : prévu / consommé / remplacé / ignoré, portions, lien vers l'entrée du journal |
| `workouts` | id | date, type, durée, distance, FC moy/max, kcal actives, dénivelé, RPE, douleurs, commentaire, terminée, séance prévue liée, **source**, identifiant externe (anti-doublons) |
| `runPlan` | id | séances du programme (blocs d'intervalles modifiables) |
| `activity` | date | pas, distance, kcal actives, kcal au repos, minutes d'exercice, sommeil, FC au repos, **source**, appareil retenu, date d'import |
| `shopping` | id | articles : quantité, unité, rayon, coché, au placard, prix saisi, habituel, quantité calculée |
| `recipes` | id | recettes personnelles |
| `sync` | `apple_health` / `shortcut` | date du dernier import, statut, message, statistiques |

Les données de référence (60 aliments, 16 recettes + 2 collations, programme 14 jours, programme de course) sont dans le code (`src/data`) et fonctionnent hors ligne.

**Dates et fuseau horaire** : chaque journée est une clé `AAAA-MM-JJ` calculée dans le fuseau de l'appareil ; les calculs de jours passent par midi local ou par UTC pour ne jamais être faussés par le passage heure d'été / heure d'hiver. Les données Apple Santé sont rattachées à la date locale d'enregistrement (le décalage horaire est inscrit dans l'export) ; le sommeil est rattaché au jour du réveil.

## 5. Apple Watch Ultra et Apple Santé : étude de faisabilité

### Ce qu'une application web peut lire directement
**Rien de HealthKit.** Safari (et tout navigateur iOS) n'expose aucune API donnant accès à Apple Santé, ni aux données de l'Apple Watch. Ce n'est pas une question de permission à demander : l'interface n'existe pas pour le web. Une page web ne peut pas non plus tourner en arrière-plan pour se synchroniser.

### Ce qui nécessite HealthKit (donc une app native)
Lecture automatique et continue des pas, de la distance, des entraînements, de la fréquence cardiaque, des calories actives et au repos, du sommeil, etc. HealthKit n'est accessible qu'à une application iOS native (Swift) avec l'autorisation HealthKit, l'utilisateur choisissant type de donnée par type de donnée ce qu'il partage.

### Option native (compagnon iOS) — coûts et contraintes réels
- Il faut **un Mac avec Xcode** (gratuit) : impossible à développer ou installer depuis un PC Windows ou depuis cet environnement.
- **Sans abonnement** (identifiant Apple gratuit, « Personal Team ») : on peut installer l'app sur son propre iPhone, mais **le certificat expire au bout de 7 jours** ; il faut ensuite réinstaller depuis Xcode. HealthKit figure parmi les capacités utilisables avec un compte gratuit d'après la documentation Apple, à revérifier au moment de le faire.
- **Avec l'Apple Developer Program (99 $/an)** : installation durable (TestFlight, 1 an), publication possible. C'est un coût : **non retenu**, conformément à la contrainte 0 €.
- La synchronisation compagnon → application web nécessiterait en plus un échange de données (fichier, ou serveur). Sans serveur, le compagnon ne peut pas écrire directement dans le stockage du navigateur.

**Conclusion** : un compagnon natif n'est pas réalisable dans les conditions « 0 € et utilisable au quotidien sans contrainte ». Le module d'import est conçu pour qu'un compagnon puisse plus tard produire le même format JSON.

### Solutions gratuites retenues
1. **Import de l'export Apple Santé (implémenté et testé)** : app Santé › profil › « Exporter toutes les données de santé » › enregistrer `export.zip` dans Fichiers › importer dans FITTRACK 88. Lecture en continu dans un Worker (fichiers de plusieurs centaines de Mo), choix de la période, ré-import sans doublons. Données lues : pas, distance marche/course, kcal actives, kcal au repos, minutes d'exercice, sommeil (phases « endormi », intervalles fusionnés), FC au repos, pesées, entraînements (type, durée, distance, kcal, FC moyenne et max, dénivelé). Limite : manuel, l'export complet prend du temps.
2. **Import JSON (implémenté et testé) pour un Raccourci iOS** : l'app Raccourcis (gratuite, d'Apple) sait lire Apple Santé (« Rechercher des échantillons de santé ») et peut copier un résumé JSON dans le presse-papiers ; FITTRACK 88 l'importe avec « Coller et importer ». **Le Raccourci lui-même n'a pas pu être construit ni testé ici** (il se crée sur l'iPhone) : la marche à suivre est dans le README.
3. **Saisie manuelle complète** de toutes les valeurs (activité, sommeil, séances, pesées).
4. **Apple Watch comme coach** : exercice personnalisé (intervalles course/marche) créé dans l'app Exercice de la montre, gratuit, puis importé.

### Autorisations
- Export Apple Santé : aucune autorisation à accorder à FITTRACK 88 (c'est toi qui exportes et choisis le fichier).
- Raccourci : iOS demande l'autorisation de lecture Santé pour chaque type de donnée au premier lancement du Raccourci.

### Provenance et statut
Chaque donnée porte sa source : *Apple Santé (export)*, *Import JSON / Raccourci*, *Import de fichier*, *Saisie manuelle*, *Calcul estimatif*, *Base locale (à vérifier)*, *Open Food Facts*, *Recette calculée*. La page Données affiche la date et le statut du dernier import (réussi, partiel, échec + message d'erreur).

## 6. Limites techniques connues

- **Pas de synchronisation automatique** entre iPhone et ordinateur : chaque navigateur a sa propre base. Transfert = sauvegarde JSON exportée puis restaurée (via iCloud Drive / Fichiers, AirDrop…). Une synchronisation automatique demanderait un serveur ou un service cloud : non retenu (coût, données de santé chez un tiers).
- **Sur iPhone, l'app installée sur l'écran d'accueil et Safari ont des stockages séparés** : utilise toujours l'icône de l'écran d'accueil.
- **Effacement par le navigateur** : Safari peut effacer les données d'un site non consulté depuis 7 jours ; les apps ajoutées à l'écran d'accueil en sont exemptées d'après WebKit. L'application demande en plus le « stockage persistant ». Une sauvegarde régulière reste indispensable.
- **Rappels** : les notifications web sur iPhone nécessitent un serveur d'envoi (Web Push) : non implémenté. Alternative gratuite : rappels dans l'app Rappels ou une automatisation Raccourcis qui ouvre FITTRACK 88.
- **Valeurs nutritionnelles de la base locale** : moyennes reprises de la table CIQUAL, saisies manuellement (l'environnement de développement n'avait pas accès au site de l'ANSES) : marquées « à vérifier ».
- **Open Food Facts** : données collaboratives, environ 10 recherches/minute ; nécessite Internet ; non testé depuis l'environnement de développement (accès réseau bloqué), le code gère erreurs et limites.
- **Dédoublonnage iPhone + Apple Watch** : approximation (appareil au total le plus élevé par jour et par mesure).
- **Scan de code-barres** : non disponible dans Safari (pas d'API BarcodeDetector) ; saisie du code à la main possible.

## 7. Règle de décision par fonctionnalité

| Fonctionnalité | Solution gratuite retenue | Limites | Données | Dépendances externes | Coût |
|---|---|---|---|---|---|
| Poids, prévision | Calculs locaux, régression sur 6 semaines | Estimation après 14 jours et 5 pesées | Locales | Aucune | 0 € |
| Besoins caloriques | Mifflin-St Jeor + facteur d'activité, déficit borné | Estimation de départ, ajustement proposé à 3 semaines | Locales | Aucune | 0 € |
| Journal alimentaire | Base locale 60 aliments + aliments perso + recettes | Valeurs locales à vérifier | Locales | Aucune | 0 € |
| Recherche produits | Open Food Facts | Internet, ~10 req/min, données collaboratives | Texte recherché envoyé à OFF ; produits choisis gardés en local | Open Food Facts | 0 € |
| Cru / cuit | Rendement de cuisson par aliment | Rendement moyen, variable selon cuisson | Locales | Aucune | 0 € |
| Programme repas, recettes | Données intégrées, calcul depuis ingrédients | — | Locales | Aucune | 0 € |
| Courses | Calcul depuis le programme | Prix uniquement saisis par toi | Locales | Aucune | 0 € |
| Course à pied | Programme modifiable, calendrier, minuteur | Minuteur suspendu écran verrouillé (Safari) | Locales | Aucune | 0 € |
| Apple Watch / Santé | Import export.zip + JSON Raccourci + saisie | Pas d'automatisme, pas de temps réel | Lues localement, jamais envoyées | Aucune | 0 € |
| Sauvegarde / transfert | Fichier JSON | Manuel | Fichier chez toi | Aucune | 0 € |
| Hébergement | Local (`npm run dev`) ou GitHub Pages / Cloudflare Pages | Offres gratuites (quotas larges pour un site perso) | Code seulement, jamais tes données | GitHub ou Cloudflare | 0 € |
| Domaine personnalisé | Non retenu | Payant (≈ 10 €/an) | — | — | évité |
