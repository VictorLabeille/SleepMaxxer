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

Le code applicatif n'est pas commencé. Sa structure sera arrêtée par la session qui l'écrira,
puis **reportée ici et dans la note Obsidian**.

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
- **Ne jamais afficher un seuil ou un verdict dont on ne peut pas citer la source.**
- **Ne jamais afficher de façon optimiste le résultat d'une écriture.** Un réglage refusé par
  le réveil ne doit jamais apparaître comme appliqué — sur une alarme, l'illusion se paie au
  réveil.
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
