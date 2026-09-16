# AGENTS.md — Guide du dépôt SleepMaxxer

> Source de vérité unique pour tout agent (humain ou IA) opérant sur ce dépôt.
> Conventions **neutres et model-agnostic**. `CLAUDE.md` ne fait que rediriger ici.
>
> Ce fichier **oriente, il ne documente pas**. Le fonctionnel est dans `README.md`, le
> pourquoi dans le cadrage, les faits dans `docs/`. Ne rien recopier ici : y renvoyer.

## Où trouver quoi — à lire avant d'écrire

| Question | Fichier |
| --- | --- |
| Que fait l'application, comment elle s'articule au backend | `README.md` |
| Ce qui est dans le périmètre et ce qui n'y est pas, **et pourquoi** | `.claude/specs/2026-09-05-spec-fonctionnelle-sleepmaxxer.md` |
| Les seuils de qualité du sommeil et leur provenance | `docs/seuils-conditions-sommeil.md` |
| À quoi ressemblait l'interface remplacée | `docs/sleepmapper/README.md` |
| À quoi ressemble l'application, écran par écran | `design/Main.dc.html`, `design/EtatsDegrades.dc.html` |
| Protocole du réveil, champs, pièges matériels | `docs/somneo-api.md` **du dépôt Somneo-Scraper** |
| Comment le code est bâti, et les choix faits **par défaut**, sans arbitrage | `.claude/specs/2026-09-14-plan-technique-app.md` |
| Ce que le collecteur ne tient pas du contrat, et ce que l'app contourne | `.claude/specs/2026-09-14-ecarts-contrat-sleepmaxxer.md` **du dépôt Somneo-Scraper** |
| Ce que l'app doit changer depuis les corrections du collecteur (2026-09-15), et ce qui reste à trancher | `.claude/specs/2026-09-15-adaptations-collecteur.md` |
| Lancer, tester, construire l'APK | `README.md`, « Développer » |

Code : `src/app` (écrans, expo-router) · `src/domain` (règles pures, testées) · `src/data`
(API, copie SQLite, rattrapage, mDNS, sauvegarde) · `src/state` (état, commandes) · `src/ui`.
Une règle métier va dans `src/domain`, jamais dans un écran.

## Règles impératives

- **Ne jamais élargir le périmètre sans demande explicite.** Une fonction n'entre que si elle
  correspond à un geste déjà accompli aujourd'hui. Ne pas proposer de statistiques, de
  tendances, d'accès distant, ni une fonction du réveil absente du cadrage — chacune y est
  exclue avec sa raison. Un écran livré qui n'est pas ouvert se **retire**, il ne s'améliore
  pas.
- **Ne jamais parler au réveil directement.** Tout passe par Somneo-Scraper.
- **La copie locale est une copie, jamais une source.** Le collecteur fait autorité en cas de
  divergence ; la synchronisation est unidirectionnelle et par ajout ; hors du réseau
  domestique l'app est en lecture seule. Deux vérités appelleraient un moteur de fusion —
  exactement ce qui a fait abandonner Santé Connect.
- **Une seule écriture du téléphone dans la mémoire du collecteur : la correction d'heure
  d'une nuit passée**, enregistrée à côté de la valeur relevée, jamais à sa place. Aucune
  autre, et jamais en masse (cadrage §5). Depuis le 2026-09-15, le collecteur sert chaque nuit,
  rattrapage compris, avec l'heure qui fait foi, son origine (`corrected` si corrigée), le relevé
  à côté (`*_observed`, `*_observed_origin`) et le journal `corrections`. Une correction
  `value: null` revient au relevé. **Lire l'origine servie**, pas une mémoire locale des
  corrections : elle seule voit un retour. Détail : écarts 1-3 de
  `.claude/specs/2026-09-14-ecarts-contrat-sleepmaxxer.md` du dépôt Somneo-Scraper.
- **Le rattrapage se fait par numéro de séquence, jamais par date** : une nuit corrigée après
  copie doit revenir. Le collecteur se trouve par mDNS, sous `_somneo-scraper._tcp` ; aucune
  adresse en dur (cadrage §5, 2026-09-12).
- **Un agrégat porte son type sous `aggregate_kind`**, dans les deux modes du rattrapage : en
  `since_seq`, `kind` est le genre de l'élément. **`hist` est une chaîne JSON**, rangée telle
  quelle. Un agrégat n'est servi qu'à son changement (2026-09-15, écarts 4 et 11 de
  `.claude/specs/2026-09-14-ecarts-contrat-sleepmaxxer.md` du dépôt Somneo-Scraper).
- **Le rattrapage se fait en trois passes, c'est le mode d'emploi officiel** (2026-09-15, écart
  6) : `before` pour les nuits récentes ; `since_seq` au fil de l'eau ; `since_seq=0` jusqu'à la
  séquence de référence, en fond. `before` ne porte que les nuits closes et leurs points : sans
  la troisième passe, la copie n'est pas complète.
- **Le catalogue du collecteur ne sert que ce que l'appareil publie.** « Aucun son », la radio
  FM, « No light » et les couleurs viennent de l'app, avec leur source
  (`docs/sleepmapper/README.md`) — 2026-09-15, écart 9.
- **L'export lit l'instantané des réglages** : `GET /v1/settings/snapshot` sert le dernier corps
  de chacun des seize profils (`profiles`, par numéro, avec `since`), `complete`, et les ports
  de réglage (`ports`). Il est en lecture seule, les profils étant relus en journée par le
  collecteur (2026-09-15, écart 7). `GET /v1/outages` et `GET /v1/aggregates` existent, par
  période (écart 8).
- **Un trou de collecte se montre avec sa cause**, celle que fournit le collecteur — quatre
  possibles, dont « carte hors réseau » (cadrage §3.C). « Collecteur arrêté » n'est écrit que
  depuis le 2026-09-15 : un trou plus ancien sans cause reste « cause non fournie ». Le statut
  dit si l'heure de la carte est synchronisée (`collecteur.heure_synchronisee`) ; l'app le
  signale, sans rien corriger (écart 5 de `.claude/specs/2026-09-14-ecarts-contrat-sleepmaxxer.md`
  du dépôt Somneo-Scraper).
- **Les heures d'une nuit viennent du collecteur (NTP), jamais du réveil** (contrat tranché le
  2026-09-13, cadrage §F). Le collecteur date une nuit par l'instant où il observe la
  transition, pas par la date que le réveil inscrit (horloge `wutim`, quelques secondes à part).
  L'app affiche ces heures telles quelles ; elle ne recompose pas une durée à partir de deux
  horloges.
- **L'app ne remet jamais l'heure du réveil, et ne promet pas qu'on le fera** : la remise à
  l'heure s'est révélée impossible (2026-09-13, cadrage §F). L'app **signale** un écart si le
  collecteur en rapporte un ; elle ne le corrige pas.
- **Ne jamais afficher un seuil ou un verdict dont on ne peut pas citer la source.**
- **Ne jamais afficher de façon optimiste le résultat d'une écriture.** Un réglage refusé par
  le réveil ne doit jamais apparaître comme appliqué — sur une alarme, l'illusion se paie au
  réveil. Même règle pour le coucher : tant que le réveil n'a pas reçu l'appui, l'app affiche
  « en attente du réveil », jamais « suivi en cours » (cadrage §5). Seule exception, un curseur en
  cours de saisie : il montre la valeur demandée, toujours marquée comme distincte de la valeur
  relue — arbitrage en commentaire dans `src/app/(tabs)/index.tsx`.
- **Ne jamais fondre en un seul message les deux pannes possibles** (collecteur muet / réveil
  injoignable) : dans le second cas l'historique reste entièrement lisible.
- **Toujours sérialiser les commandes vers le réveil.** Il sature sous une rafale (~25 ko de
  tas libre). C'est le matériel, pas un bug.
- **L'app reflète l'appareil, elle ne fait pas autorité.** En cas de désaccord, le réveil gagne.

## Pièges du dépôt

- **`docs/sleepmapper/*.png` n'est pas versionné** (données personnelles, dépôt public) : sur
  un clone frais, seul le relevé écrit existe. Ne pas s'en étonner, ne pas chercher à
  regénérer les images.
- **Ces captures ne sont pas reproductibles.** Prises le 2026-09-05, réveil encore connecté au
  cloud ; une fois l'isolement fait, les écrans d'historique de SleepMapper se vident. Ne
  jamais supprimer le dossier.
- **Les seuils de `docs/seuils-conditions-sommeil.md` ne viennent d'aucune API** et
  disparaîtront avec SleepMapper. Ce fichier est leur seule trace.
- **`design/*.html` n'est pas versionné, `design/*.dc.html` l'est.** Les canvas publiés pèsent
  ~2,5 Mo chacun — c'est le code de l'éditeur, pas la maquette. Ils se **régénèrent** depuis les
  `.dc.html` et `canvas.json`. Modifier une maquette, c'est modifier un `.dc.html`, jamais le
  `.html` produit — et jamais les deux, la régénération écrase.
- **Le prototype tient dans un seul artboard.** Les dix écrans de `Main.dc.html` partagent un
  état ; deux artboards ne partagent rien. Ne pas « ranger » un écran dans un fichier à part :
  la navigation cesserait de fonctionner.

## Pièges d'outillage

- **Expo SDK 56** : lire la documentation versionnée (`docs.expo.dev/versions/v56.0.0`), pas celle
  de la dernière version.
- **Les icônes de `assets/images/` dérivent toutes de `logo-source.jpg`** (détourage du fond, puis
  mise à l'échelle dans la zone sûre Android) : les regénérer depuis lui. L'outil de génération est
  `sharp`, à installer hors du dépôt — **ce n'est pas une dépendance du projet**, et ni Pillow ni
  ImageMagick ne sont disponibles sur le poste.
- **`npm run lint` installe ESLint dans le dépôt** : `expo lint` l'ajoute aux `devDependencies` et
  réécrit `package.json` et `package-lock.json` avant d'échouer. Rendre les deux fichiers ensuite.
- **`android/` est généré** par `expo prebuild` (et par EAS), non versionné. Toute configuration
  native passe par `app.json` et ses plugins, jamais par une retouche de `android/`.
- **TypeScript 6 ne charge plus les `@types/*` d'office** : `tsconfig.json` les déclare (`jest`,
  `node`). Un nouveau paquet de types s'y ajoute.
- **Le preset `jest-expo` remplace `fetch` par un simulacre** : un test qui veut le vrai réseau
  (le contrat vérifié contre le collecteur) passe par `node:http`.
- **Les tests dépendent du fuseau** : `npm test` fixe `TZ=Europe/Paris`. `jest` lancé à nu fait
  échouer les tests d'heures.
- **Pas de mDNS dans l'émulateur ni dans le navigateur** (NAT) : `EXPO_PUBLIC_COLLECTOR_URL`, en
  développement seulement — jamais dans un fichier versionné, jamais dans une version livrée.
- **`src/data/testing/` est hors de `__tests__/`** exprès : jest prend tout fichier de
  `__tests__/` pour une suite, y compris le faux collecteur.
- **Un build Gradle interrompu laisse des JSON vides dans les `.cxx`** (`node_modules/*/android/.cxx`,
  `android/app/.cxx`) : le suivant échoue en `EOFException … line 1 column 1`. Les supprimer.
- **Ne jamais essayer une écriture le soir** : le réveil est dans une chambre, et un « je me
  couche » d'essai crée une vraie nuit dans le collecteur.
- **L'APK construite en local est signée par la clé de débogage publique du modèle React Native**
  (`android/app/debug.keystore`, recopiée à l'identique par chaque `prebuild`) : d'un poste à
  l'autre, elle se met à jour par-dessus. **Une APK d'EAS est signée par une autre clé** : elle ne
  s'installe qu'après désinstallation, ce qui **efface la copie locale**. Exporter une sauvegarde
  avant de changer de chaîne de construction.

## Dépôt public

Ne jamais versionner de clé, numéro de série, adresse MAC, SSID ni mot de passe. Vérifier
qu'une capture ou un exemple ne contient pas de donnée personnelle avant de le committer.

## Conventions d'écriture

- **Prose en français** : documentation, commentaires, messages de commit.
- **Identifiants, noms de fichiers et de variables en anglais.**

## Note Obsidian associée

`Projets/SleepMaxxer.md` (`type: project`) dans le vault personnel. **À mettre à jour après
tout changement significatif** : statut, périmètre, décisions, journal.

Ne **pas** éditer à la main `created` / `updated` / `repo` : dérivés du git par
`_scripts/sync-projects.py`, à relancer après un push.

Une décision touchant le **contrat avec Somneo-Scraper** (format des données, endpoints,
répartition des responsabilités) se reporte dans les **deux** notes Obsidian et dans
l'`AGENTS.md` de l'autre dépôt.
