# Adapter l'application au collecteur corrigé

> Statut : **à faire** · Date : 2026-09-15 · Suite des onze écarts du collecteur au contrat
> (`.claude/specs/2026-09-14-ecarts-contrat-sleepmaxxer.md` **du dépôt Somneo-Scraper**), tranchés
> un par un par Victor et corrigés côté collecteur le 2026-09-15, jusqu'à `c00bf47`. **Le
> collecteur corrigé n'est pas encore déployé sur la carte** : elle tourne `4cd5e54`.

Ce document dit ce que l'application doit changer pour tirer parti des corrections, et retirer ses
contournements. Pour chaque point : ce que le collecteur sert désormais, ce que l'app en fait,
les fichiers à toucher, et ce qui reste à trancher. Le pourquoi de chaque correction est dans la
spec des écarts ; le contrat, résumé, dans l'`AGENTS.md` de ce dépôt. Rien n'est écrit ici qui
n'ait été lu dans le code de l'app le 2026-09-15 (`a7f48ee`).

## 0. Contrainte transversale : marcher contre les deux collecteurs

La date du déploiement n'est pas connue. Tant qu'il n'a pas eu lieu, le collecteur est
l'ancien : aucun des champs ci-dessous n'existe, `/v1/settings/snapshot` répond `404`, et le
pilotage reste bloqué par l'écart 10. **Tout champ nouveau est donc optionnel côté app**, et son
absence ramène au comportement d'aujourd'hui. Aucun changement ne doit supposer le déploiement
fait.

Le faux collecteur des tests (`src/data/testing/fake-collector.ts`) sert aujourd'hui l'ancien
contrat, `aggregate_kind` absent compris. Il doit apprendre le nouveau, et au moins un test doit
garder l'ancienne forme.

## 1. Corrections d'heure (écarts 1, 2, 3)

**Ce que le collecteur sert.** Toute nuit, par toutes les routes, rattrapage compris (les deux
modes), porte :

- `bedtime`/`risetime` : l'heure qui fait foi, c'est-à-dire la dernière correction du champ,
  sinon le relevé ;
- `bedtime_origin`/`risetime_origin` : `corrected` si une correction fait foi, sinon l'origine
  du relevé ;
- `bedtime_observed`/`risetime_observed` et `…_observed_origin` : le relevé et son origine,
  toujours ;
- `corrections` : le journal, dans l'ordre (`id`, `seq`, `night_id`, `ts`, `field`, `value`).

`POST /v1/nights/{id}/corrections` avec `value: null` **revient au relevé**. Le retour entre au
journal, avec `value: null`. Sans correction en vigueur, il n'écrit rien et répond `200`. Un
lever qui précéderait le coucher servi est refusé (`422`), retour compris. Une correction ne
touche plus jamais la valeur relevée : une écriture de la machine des nuits ne peut plus
l'écraser.

**Ce que l'app doit changer.**

- **Types** (`src/data/types.ts`) : `Night` reçoit les quatre champs `*_observed*` et
  `corrections`, optionnels ; `NightCorrection.value` devient `Epoch | null`.
- **Retirer la mémoire locale `corrected`.** L'app retient seule les heures qu'elle a corrigées,
  parce que le collecteur ne le servait pas. Désormais, l'origine servie fait foi, et elle seule
  voit un retour au relevé ou une correction faite ailleurs. Endroits concernés :
  - `storeNightFromCollector(night, correctedFields)` et la colonne `corrected`
    (`src/data/db.ts`) ;
  - l'appel dans `correctNight` (`src/state/commands.ts`) ;
  - `timeOrigin(n, field, corrected)` et `parseCorrected` (`src/domain/nights.ts`) ;
  - `isEstimated` (`src/app/(tabs)/sleep.tsx`), la ligne `estimated` de `src/app/calendar.tsx` ;
  - les deux appels de `src/ui/night-views.tsx`.
  - Pour marcher contre l'ancien collecteur, la mémoire locale peut servir de repli tant qu'une
    nuit arrive sans `*_observed` (à trancher, §9).
- **Montrer le relevé.** Le critère d'acceptation du cadrage le demande : une heure corrigée
  laisse « la valeur relevée d'origine consultable ». Dans le détail d'une nuit, une heure
  d'origine `corrected` montre aussi `*_observed` et son origine.
- **Revenir au relevé.** La correction est « tracée et réversible » (cadrage §5).
  `correctNight` (`src/data/api.ts`) accepte `value: null`. Une heure corrigée offre « revenir à
  l'heure relevée ».
- **Copie locale.** Les colonnes `*_observed*` entrent dans le schéma local et dans
  `NIGHT_COLUMNS` (`src/data/db.ts`), avec une migration. Garder ou non le journal
  `corrections` dans la copie : à trancher (§9).

**Vérification.** Tests de `src/domain` (origines, résolution d'une correction), de la copie
(une nuit corrigée puis revenue au relevé, reçue par `since_seq`), et contre le faux collecteur
aux deux formes.

## 2. Type des agrégats (écarts 4 et 11)

**Ce que le collecteur sert.** En `since_seq`, `kind` reste le genre de l'élément
(`aggregate`), et le type (`temp`, `hum`, `snd`, `lux`) arrive sous `aggregate_kind`. En mode
`before`, `kind` était déjà juste ; `aggregate_kind` y est aussi. `hist` reste une chaîne JSON,
désormais écrite au contrat. Un agrégat n'est plus servi qu'à son changement ; les doublons déjà
en base restent.

**Ce que l'app doit changer.**

- `pageFromItems` (`src/data/sync.ts`) range l'agrégat avec `kind: item.aggregate_kind ?? null`
  au lieu de `kind: null`, et le commentaire du contournement disparaît. Le type `SyncItem`
  (`src/data/types.ts`) reçoit `aggregate_kind` optionnel, et le commentaire de `Aggregate.kind`
  suit.
- **Les agrégats déjà copiés sans type ne reviendront pas d'eux-mêmes** : le collecteur ne les
  renvoie pas. La clause `ON CONFLICT(seq) DO UPDATE SET kind = COALESCE(aggregate.kind,
  excluded.kind)` de `writePage` (`src/data/db.ts`) sait déjà remplir un type manquant quand un
  agrégat revient. Il suffit donc d'une passe de réparation, une fois. Moyen à trancher (§9) :
  `GET /v1/aggregates?from=0` (écart 8), ou rejouer la troisième passe du rattrapage.

## 3. Indisponibilités et heure de la carte (écart 5)

**Ce que le collecteur sert.** « Collecteur arrêté » est désormais écrit, du dernier signe de vie
du collecteur au premier relevé de la reprise. Les trous plus anciens restent sans cause.
`GET /v1/status` porte `collecteur.heure_synchronisee` (`true`, `false`, ou `null` si non
surveillée). La carte n'a pas d'horloge qui survive à une coupure : elle repart en retard jusqu'à
la synchronisation NTP, et le collecteur l'attend avant de dater quoi que ce soit.

**Ce que l'app doit changer.**

- `gapCause` (`src/domain/stats.ts`) connaît déjà « collecteur arrêté » : rien à faire. « Cause
  non fournie par le collecteur » reste juste pour les trous d'avant le déploiement.
- Juste après un redémarrage du collecteur, `reveil.cause_indisponibilite` peut valoir
  « collecteur arrêté » quelques secondes. **À vérifier** : que `deviceCauseTitle`
  (`src/state/link.ts`) et le bandeau de `src/app/(tabs)/index.tsx` le nomment bien, sans le
  confondre avec « réveil injoignable ».
- `CollectorStatus.collecteur` (`src/data/types.ts`) reçoit `heure_synchronisee?: boolean | null`.
  Quand elle vaut `false`, l'app le **signale**, sans rien corriger (cadrage §3.F). L'endroit où
  le signaler est à trancher (§9).

## 4. Rattrapage (écart 6)

Les trois passes que l'app fait déjà deviennent le mode d'emploi officiel : `before` pour les
nuits récentes, `since_seq` au fil de l'eau, `since_seq=0` jusqu'à la séquence de référence en
fond. **Rien à changer**, sinon l'en-tête de `src/data/sync.ts`, qui présente la troisième passe
comme le contournement d'un écart alors qu'elle est désormais le contrat.

## 5. Export : l'instantané des réglages (écart 7)

**Ce que le collecteur sert.** `GET /v1/settings/snapshot` renvoie `served_at`, puis :

- `profiles` : pour chacun des seize profils d'alarme connus, par numéro (`"1"` … `"16"`), le
  dernier corps de `wualm/prfwu` (`body`) et depuis quand il vaut cela (`since`) ;
- `complete` : vrai si les seize sont là ;
- `ports` : les ports de réglage `wulgt`, `wudsk`, `wualm`, `wualm/aenvs`, `wualm/aalms` et
  `wuply`, dans la forme du miroir (`body`, `since`, `observed_at`).

Le collecteur relit les seize profils une fois par jour entre 12 h et 18 h, et de nouveau après
un changement d'alarme ; l'app en fait autant quand elle ouvre une alarme. Juste après le
déploiement, `complete` reste faux jusqu'à la première fenêtre de journée.

**Ce que l'app doit changer.** L'export (`writeExportFile`, `src/data/backup-io.ts`) n'emporte
aujourd'hui que `settings`, le dernier miroir de `GET /v1/device` gardé en `device.last`. Il
doit emporter l'instantané. À trancher (§9) :

- l'ajouter à côté de `settings`, ou le mettre à sa place ;
- passer `BACKUP_VERSION` à 2, sachant que `parseBackup` (`src/domain/backup.ts`) doit encore
  lire la version 1 ;
- que faire quand l'instantané manque (`404`, `complete: false`) : exporter quand même, en le
  disant, semble la règle du cadrage (« refus net » ne vaut que pour l'import).

Remettre un réveil en état depuis l'instantané n'est pas demandé ici.

## 6. Routes par période (écart 8)

`GET /v1/outages?from=&to=` (les indisponibilités qui chevauchent la période, l'ouverte
comprise) et `GET /v1/aggregates?from=&to=` existent. Aucune obligation ; la seconde peut servir
la réparation du §2.

## 7. Catalogue (écart 9)

Le contrat s'amende : le catalogue du collecteur ne sert que ce que l'appareil publie, et l'app
garde « aucun son », la radio FM, « No light » et les couleurs, avec leur source
(`docs/sleepmapper/README.md`). C'est déjà ce que fait `src/domain/catalog.ts` : **rien à
changer**.

## 8. Pilotage (écart 10)

Rien à changer côté app : elle désactive le pilotage quand le collecteur dit le réveil
injoignable, et c'est ce qu'il disait à tort. Après le déploiement, le pilotage doit revenir. À
essayer sur le téléphone, **en journée** (règle de l'`AGENTS.md`).

## 9. À trancher par Victor

1. **Mémoire locale `corrected`** : la retirer d'un coup (l'app ne montre plus « corrigé » tant
   que la carte n'est pas déployée), ou la garder en repli tant qu'une nuit arrive sans
   `*_observed`.
2. **Journal des corrections dans la copie locale** : le garder (la copie reste complète si le
   collecteur est effacé, critère d'acceptation) ou non.
3. **Où montrer le relevé** d'une heure corrigée, et où placer « revenir à l'heure relevée »
   (maquettes : `design/Main.dc.html`).
4. **Réparation des agrégats sans type** : `GET /v1/aggregates?from=0`, ou rejouer la troisième
   passe.
5. **Heure de la carte non synchronisée** : où le signaler (état de la liaison, écran du
   collecteur, bandeau).
6. **Export** : instantané à côté de `settings` ou à sa place, version du format, et conduite
   quand il manque.

## 10. Vérification

- La suite jest, avec le faux collecteur aux deux formes : ancien contrat et nouveau.
- Contre le collecteur réel, **après son déploiement** :
  - une nuit corrigée puis revenue au relevé, vue par le rattrapage ;
  - des agrégats typés arrivés par `since_seq` ;
  - `heure_synchronisee` affichée ;
  - un export portant l'instantané (`complete: true` après une fenêtre 12 h – 18 h) ;
  - le pilotage rétabli, essayé en journée.
