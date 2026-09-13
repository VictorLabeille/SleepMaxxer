# Cadrage — SleepMaxxer, application de remplacement de SleepMapper

> Statut : **validé** · Date : 2026-09-05 · Contrat avec le collecteur mis à jour le
> 2026-09-12 (§5)

Premier cadrage du projet. Il porte sur **l'application entière**, pas sur une fonctionnalité :
c'est lui qui décide de ce qui existe et, surtout, de ce qui n'existera pas. Il précède
volontairement l'écriture du backend — la forme de l'API de [Somneo-Scraper] doit être dictée
par ce document, décision prise le 2 septembre 2026 et consignée dans l'`AGENTS.md` de ce dépôt.

Références : `docs/sleepmapper/` (relevé de l'interface remplacée), `docs/somneo-api.md` du dépôt
Somneo-Scraper (protocole du réveil), notes Obsidian `Projets/SleepMaxxer.md` et
`Projets/Somneo-Scraper.md`.

---

## 1. Contexte & objectif métier

### Problème / besoin

Le Philips Somneo HF3671/01 est en permanence connecté aux serveurs Philips, et l'application
constructeur **SleepMapper** est lente à démarrer et encombrée de fonctions inutilisées
(onglet « Conseils » éditorial, onglet « Plus » de gestion de compte).

Le point décisif n'est pas le confort, c'est une **dépendance** : la rétro-ingénierie du
31 août 2026 a établi que l'API locale du réveil **n'a aucune mémoire**. Elle ne donne que
l'instant présent, la fenêtre d'agrégation de 15 minutes en cours et la nuit en cours. Les
courbes d'historique de SleepMapper viennent du cloud Philips, que le réveil alimente lui-même.

**Couper l'accès internet du réveil supprime donc la fonction principale de l'application
constructeur.** Isoler le Somneo — l'objectif du projet — n'est possible qu'à condition de
posséder d'abord son propre historique et sa propre télécommande. SleepMaxxer n'est pas un
confort : c'est la condition de l'isolement.

S'y ajoute un constat d'hygiène relevé le même jour : le réveil n'applique **aucun contrôle
d'accès sur le réseau local**. Le port qui livre la clé de sécurité et celui qui déclenche une
réinitialisation d'usine répondent à quiconque se trouve sur le LAN. L'isolement cesse d'être
une préférence pour devenir une mesure raisonnable.

### Valeur attendue / pourquoi maintenant

- **Rendre l'isolement possible sans rien perdre** : conserver le suivi de nuit et les
  conditions de chambre après la coupure, et retrouver la télécommande des fonctions
  réellement utilisées.
- **Démarrer instantanément**, là où SleepMapper attend une session cloud.
- **Faire mieux que l'original sur la donnée** : le réveil n'échantillonnait vers Philips que
  toutes les 15 minutes ; la collecte locale peut être plus fine, et capte les extrema que
  l'échantillonnage manquait.
- **Servir de pièce de portfolio.** Le projet vise une candidature de stage (mai–novembre 2027)
  auprès d'un chercheur en e-health du département de biomédecine de LTH, à Lund. L'application
  est la partie visible d'une chaîne d'acquisition de données physiologiques et d'environnement
  de sommeil construite de bout en bout. Cela impose une exigence de finition et de sobriété
  qui ne serait pas justifiée pour un outil purement personnel.

### Parties prenantes & utilisateurs

**Un seul utilisateur, un seul appareil, aucun rôle.** Pas de compte, pas d'authentification,
pas de multi-utilisateur — ni côté réveil (aucun appairage n'est exigé par ce firmware), ni
côté application.

Un **second public, non-utilisateur** : les lecteurs du portfolio. Ils ne se serviront jamais
de l'app ; ils la jugeront sur des captures et sur la cohérence du récit d'ingénierie. Ce
public justifie l'exigence de conception, **jamais** un ajout de fonctionnalité.

### Indicateurs de succès

- **Le réveil est effectivement coupé d'internet** et rien de ce qui servait au quotidien n'a
  été perdu dans l'opération.
- **L'app est encore ouverte tous les jours trois mois après sa livraison.** C'est
  l'indicateur cardinal, et le seul qui départage ce projet de ses prédécesseurs : l'onglet
  Stats de Commit & Push a été spécifié, construit, livré — et jamais utilisé.
- Aucun écran livré n'est resté sans usage. Un écran qu'on n'ouvre pas est un échec de
  cadrage, pas un bonus.
- L'application est présentable à un chercheur sans qu'il faille s'excuser de son état.

### Contrainte cardinale de périmètre — à opposer à toute demande ultérieure

Deux échecs documentés fixent la règle :

| Projet | Ce qui a été livré | Ce qui s'est passé |
| --- | --- | --- |
| **Commit & Push** | Un onglet Stats à 6 indicateurs, entièrement cadré le 2026-06-22 | Livré, jamais utilisé. Le cadrage était bon, le besoin était imaginaire. |
| **FshnRps-GAOE** | 6 écrans, moteur de calcul testé, extension navigateur companion | L'application entière est trop lourde pour l'usage qu'elle sert. |

D'où la règle appliquée dans tout ce document : **une fonction n'entre que si elle correspond
à un geste déjà accompli aujourd'hui**, avec SleepMapper ou avec la façade du réveil. Ce qui
serait « bien d'avoir » est hors périmètre par défaut, et le restera jusqu'à ce que le manque
se fasse sentir à l'usage. Le retrait est gratuit maintenant, coûteux plus tard.

Conséquence assumée : le périmètre ci-dessous est **plus petit que SleepMapper**, et plus petit
que ce que l'API du réveil permet.

---

## 2. Périmètre

L'application reprend la structure à deux onglets de SleepMapper — **Mon Appareil** (piloter)
et **Mon Sommeil** (consulter) — et abandonne ses deux autres onglets. Ce choix n'est pas
esthétique : l'utilisateur remplace une application qu'il pratique déjà, et n'a aucune raison
de réapprendre une navigation.

### Dans le périmètre

#### A. Onglet « Mon Appareil » — pilotage

- **Alarmes.** Liste des alarmes que le réveil déclare visibles, avec pour chacune l'heure,
  la récurrence, un interrupteur d'activation et l'indication du PowerWake s'il est armé.
  Création, modification et suppression d'une alarme.
  - Le réveil tient **seize emplacements** de profil en mémoire, dont l'immense majorité sont
    des emplacements dormants — réglages d'usine ou restes d'alarmes supprimées, une
    suppression côté application ne faisant que masquer le profil. **Aucun n'est perdu en ne
    les affichant pas**, et aucun ne peut sonner tant qu'il est désactivé. L'app se cale donc
    sur ce que le réveil affiche : parité avec la façade, pas avec l'API.
  - **Champs éditables d'une alarme**, arrêtés le 2026-09-05 : heure, jours de répétition,
    activation, PowerWake (et son heure), thème lumineux, durée et intensité du lever de
    soleil, source sonore, piste, volume, départ en douceur, durée du rappel.
  - C'est **délibérément plus large que SleepMapper**, qui n'expose qu'heure, thème du soleil,
    son, répétition, PowerWake et durée du somme. L'écart est assumé : les quatre réglages
    ajoutés (durée et intensité du lever, volume, départ en douceur) existent dans l'appareil
    et sont ce qui décide si un réveil est doux ou brutal — les laisser à la façade revenait à
    ne jamais les toucher. **C'est le seul endroit du cadrage où l'on va au-delà de l'existant**,
    et c'est donc l'écran à surveiller : s'il devient un formulaire, il aura échoué.
  - **La durée du rappel est globale à toutes les alarmes**, pas propre à l'une d'elles —
    SleepMapper l'affiche dans l'écran d'alarme en le précisant noir sur blanc, et le protocole
    le confirme. Le présenter comme un réglage par alarme serait un mensonge d'interface.
  - Thème lumineux et son se choisissent **par leur nom dans une liste** (« Sunny day »,
    « Summer Birds »), sur un écran de sélection dédié — pas dans un menu déroulant au milieu
    du formulaire.
- **Suivi de l'heure de coucher.** Un bouton « je me couche » qui **écrit dans le réveil**,
  comme le faisait SleepMapper. Le réveil reste le dépositaire de l'heure ; l'application
  est le geste, pas la mémoire. Si le réveil ne répond pas à cet instant, l'appui n'est
  **jamais perdu** : le collecteur retient l'heure de l'appui, qui fait foi, et ouvre la session
  dans le réveil dès qu'il répond — le réveil n'accepte pas d'heure passée (§5) —, et
  l'application affiche « coucher enregistré, en attente du réveil » — jamais « suivi en
  cours » (voir §5).
- **Lumière et veilleuse.** Allumage, extinction, réglage d'intensité, bascule de la veilleuse.
- **Coucher de soleil.** Lancement, arrêt, et réglage de la durée et de ses paramètres.

#### B. Onglet « Mon Sommeil » — restitution

- **Temps au lit**, pour une nuit : durée, heure de coucher, heure de lever, avec correction
  manuelle possible des deux heures. Pour une nuit passée, la correction s'enregistre **dans le
  collecteur, à côté de la valeur relevée**, jamais à sa place : c'est la seule écriture du
  téléphone dans la mémoire (voir §5).
- **Conditions de la chambre** pour cette nuit : température, humidité, lumière et bruit, avec
  leur valeur, leur unité et **le verdict correspondant** (« conditions de sommeil idéales »,
  « trop chaud », « trop humide »…), assorti d'une icône d'état.
  - Les seuils sont ceux **relevés dans SleepMapper**, consignés dans
    `docs/seuils-conditions-sommeil.md`. Ils sont figés dans l'application et **leur source est
    citée** : c'est ce qui distingue un verdict d'une opinion.
  - Deux familles d'échelles, à ne pas confondre : température et humidité ont cinq bandes
    symétriques qui **jugent** ; lumière et bruit ont un seul seuil de qualité, au-delà duquel
    les libellés sont des **repères de comparaison** (« équivalent à une bibliothèque
    municipale »), jamais des jugements.
- **Détail d'une mesure** : la **courbe de la nuit** pour la grandeur choisie, avec ses
  minimum, moyenne et maximum, et la **plage recommandée tracée en fond** — c'est elle qui rend
  la courbe lisible sans connaître les seuils. Échelle logarithmique pour la lumière. C'est ce
  que le cloud Philips produisait, et ce que la collecte locale sait reconstituer.
- **Échelle des seuils consultable** depuis l'écran de détail, sur le modèle de la section
  « Informations » de SleepMapper : elle est ce qui rend le verdict vérifiable par le lecteur.
- **Navigation nuit par nuit** : revenir à la nuit précédente, avancer, revenir à la dernière.
  Aucune agrégation, aucune période plus longue que la nuit.
- **Vues agrégées par semaine et par mois**, à parité avec SleepMapper (décision du
  2026-09-06, voir §5) : durée moyenne de la période, comparaison à la période précédente, et
  un graphique en barres dont **l'axe vertical est l'heure de la journée** — chaque barre
  montre la plage de sommeil, pas seulement sa durée, si bien que la régularité des horaires
  se lit d'un coup d'œil.
- **Historique en calendrier mensuel**, atteint par l'icône de calendrier : une pastille par
  jour portant la durée, les jours sans donnée dessinés vides, et le choix de la grandeur
  affichée (temps au lit ou conditions).
- **Distinction confirmé / estimé** portée partout où une heure s'affiche.
- **Résumé textuel pour le coach Google Health**, déclenché par un bouton sur l'écran de la
  nuit consultée : le texte est copié dans le presse-papier et partageable. Même mécanisme que
  le bilan de séance de Commit & Push, dont il reprend l'esprit.

#### C. Copie locale et sauvegarde

Ajouté le 2026-09-06. Le collecteur est, après l'isolement, la **seule** mémoire de
l'historique — et il vit sur une carte d'occasion, sur eMMC, alimentée par le port USB d'un
réveil, sans écran ni console série. C'est un **point unique de défaillance sur une donnée
irremplaçable** : ce qui est perdu ne se remesure pas. Le téléphone est le seul autre appareil
qui voit ces données.

- **Copie locale complète et indéfinie.** L'application conserve sur le téléphone l'intégralité
  de l'historique — nuits et relevés de capteurs — sans fenêtre glissante ni purge.
- **Rattrapage à chaque ouverture**, quand le collecteur répond : l'app demande ce qui est
  arrivé depuis son dernier relevé et l'ajoute. Pas de tâche de fond, pas de permission
  supplémentaire.
- **Consultation complète hors du domicile**, en lecture seule.
- **Export vers le Drive**, déclenché à la main, avec une **invite non bloquante** quand du
  temps a passé depuis le dernier export. C'est le seul « automatique » praticable sur mobile
  sans backend — constat déjà établi pour Commit & Push le 2026-06-22, et qui n'a pas changé.
- **Contenu de l'export** : les données **et les réglages du réveil** (alarmes, thèmes,
  coucher de soleil), pour qu'un réveil réinitialisé ou remplacé puisse être remis en état.

Trois règles sans lesquelles cette fonction dérape :

1. **Le téléphone détient une copie, jamais une source.** Le contrat reste « le collecteur est
   la mémoire ». En cas de divergence, **le collecteur gagne**. Sans cette règle il y a deux
   vérités et un moteur de fusion à écrire — précisément ce qui a fait abandonner Santé Connect.
2. **La synchronisation est unidirectionnelle et par ajout.** Un relevé de capteur ne se
   modifie pas, il s'accumule. Ce n'est pas de la synchronisation, c'est du rattrapage.
3. **Hors du réseau domestique, l'application est en lecture seule.** Aucun pilotage, aucune
   correction d'heure — le réveil et le collecteur sont à la maison.

**Remplacer un collecteur mort : à la main, depuis le Drive** (tranché le 2026-09-06).
L'application ne repeuple jamais un collecteur neuf : le backend n'a besoin d'aucun point
d'entrée d'écriture en masse — ce qui lui épargne le seul endroit où il aurait pu recevoir des
données non vérifiées. La règle « le téléphone n'écrit jamais dans la mémoire » garde **une
seule exception**, décidée au cadrage du backend : la correction d'heure d'une nuit passée,
tracée et réversible (voir §5). Le rôle de filet de sécurité repose sur l'export Drive, dont c'est la
raison d'être : le téléphone sert à consulter, le fichier sert à restaurer.

> **Conséquence pour le backend, à intégrer dès sa conception** : l'API du collecteur doit
> exposer un point d'entrée paginé qui rend tout ce qui a été créé **ou modifié** depuis la
> dernière synchronisation — repéré par un **numéro de séquence**, pas par une date (§5,
> 2026-09-12). Ajouté après coup, il obligerait à retoucher le schéma de la base.

#### D. Transversal

- **État de la liaison** visible et compréhensible, distinguant les deux pannes possibles
  (voir §3) : l'application ne doit jamais laisser croire à une panne du réveil quand c'est le
  collecteur qui est muet, ni l'inverse.

#### E. Conception (livrable à part entière, pas une finition)

- **Maquettes des écrans** produites et validées avant l'implémentation.
- **Direction artistique sobre** — le « liquid glass » a été exploré puis **écarté** le
  2026-09-06 (voir §5). L'exigence qui l'encadrait vaut pour la direction retenue : l'app est
  une pièce de candidature auprès de chercheurs, l'effet est au service de la lisibilité,
  jamais l'inverse — pas de démonstration technique gratuite, pas d'illisibilité assumée au
  nom du style.
- **Familiarité d'usage avec SleepMapper** : structure à deux onglets, découpage en sections
  titrées, une carte par fonction sur l'écran de pilotage, le détail toujours derrière la
  carte, le chiffre comme élément porteur. Les intentions de `docs/sleepmapper/README.md` sont
  reprises ; leur exécution visuelle ne l'est pas.

### Hors périmètre (explicite)

Chaque exclusion porte sa raison. Aucune n'est définitive — mais aucune ne rentre sans qu'un
manque se soit manifesté à l'usage.

| Exclu | Pourquoi |
| --- | --- |
| **RelaxBreathe** | N'est utilisé ni depuis l'app, ni depuis la façade. Aucune raison de le porter. |
| **Radio FM et ses présélections** | Fonction périphérique, non pratiquée. |
| **Réglages d'afficheur du réveil** (affichage permanent, luminosité 1–6) | Se règle une fois pour toutes, se fait déjà sur la façade. Reste une bonne **matière de contribution à `pysomneo`** (issue #13) — mais c'est le dépôt du backend qui la portera, pas l'app. |
| **Seuils réglables par l'utilisateur** | Les seuils sont figés et documentés. Les rendre modifiables ajouterait un écran de réglages pour un besoin qui ne s'est pas manifesté. |
| **Exposition du collecteur à internet** (VPN, tunnel, ouverture de port) | Une couche réseau à concevoir, sécuriser et maintenir sur un appareil sans contrôle d'accès. Le besoin qui la motivait — consulter hors du domicile — est couvert autrement, par la copie locale : les données sont déjà dans la poche. Supprimer le problème plutôt que le traiter. |
| **Synchronisation Santé Connect** | Piste explorée puis **abandonnée** : l'API n'a pas de champ pour les données de capteurs, et la priorité de source n'est pas chirurgicale — corriger la seule heure de coucher supposerait de relire la session existante, la recomposer et la réécrire, par-dessus des entrées Fitbit déjà désordonnées. Remplacée par le résumé textuel. |
| **Compte, appairage, authentification** | Le firmware n'en exige aucun : le schéma de défi/réponse existe dans l'app constructeur mais n'est jamais déclenché, le port d'appairage répond « non implémenté ». Rien à construire. |
| **Onglets « Conseils » et « Plus »** | Contenu éditorial générique et gestion de compte. C'est le bloat qu'on retire. |
| **Synchronisation bidirectionnelle** | Le téléphone n'écrit jamais dans la mémoire du collecteur, à une exception près : la correction d'heure d'une nuit passée, enregistrée à côté de la valeur relevée. Voir §2.C et §5. |
| **Pilotage depuis plusieurs téléphones, notifications push, widgets** | Aucun usage identifié. |

### Hypothèses

- **Le collecteur reste la source de l'historique**, le téléphone n'en tient qu'une copie.
- **L'application ne parle jamais au réveil pour l'historique** — uniquement au collecteur
  Somneo-Scraper, seule mémoire existante après isolement. Le temps réel et le pilotage
  transitent également par le collecteur, qui relaie.
- **Le collecteur et le téléphone sont sur le même réseau domestique.** Aucune exposition
  vers l'extérieur.
- Le collecteur expose son API **sans authentification**, comme le réveil lui-même. L'app
  n'aggrave donc aucun risque existant — mais cette hypothèse doit être re-examinée si le
  réseau domestique cesse d'être de confiance.
- Application **Android, Expo / React Native**, installée sur le téléphone (la note du
  backend évoque par endroits une PWA : la contradiction est tranchée ici en faveur de
  l'application installée, cohérente avec le cache hors ligne et avec la note du projet).
- Le réveil reste **physiquement accessible** : sa façade demeure le moyen de secours pour
  tout ce que l'app ne porte pas.
- Les heures, dates et durées sont en **heure locale de l'appareil**, une « nuit » étant
  rattachée au jour de son heure de coucher.
- Le geste « je me couche » est fait au moment de se coucher, dans le noir, d'une seule main.
  C'est la contrainte d'ergonomie dominante de l'onglet de pilotage.

---

## 3. Cas limites, erreurs & états dégradés

### A. Liaison, disponibilité, dégradation

La distinction la plus importante de tout le document : **deux pannes indépendantes existent**,
et l'utilisateur doit toujours savoir laquelle le concerne. Le collecteur peut être muet alors
que le réveil va bien ; le réveil peut être injoignable alors que le collecteur répond et
détient tout l'historique.

| Cas | Déclencheur | Comportement attendu |
| --- | --- | --- |
| Hors du réseau domestique | L'app est ouverte ailleurs qu'à la maison | **Tout l'historique reste consultable** — il est sur le téléphone (§2.C) — mais la copie est **explicitement datée** (« copie du … ») : elle s'arrête au dernier rattrapage. Le pilotage est désactivé, pas masqué, avec la raison affichée. Ce n'est pas une panne et ne doit pas s'afficher comme telle. |
| Collecteur injoignable | Le serveur est arrêté, redémarre, ou le réseau est coupé | Message nommant la cause (« collecteur injoignable ») et non un échec générique. **L'historique reste lisible dans la copie locale**, daté du dernier rattrapage ; c'est le rattrapage qui s'arrête, pas la consultation. Pilotage désactivé, nouvelle tentative sans quitter l'écran. |
| Collecteur joignable, réveil injoignable | Le réveil est débranché, ou son adresse a changé | **L'historique reste consultable en entier** — il est dans le collecteur. Seul le pilotage et le temps réel sont indisponibles, et le message le dit ainsi. |
| Réveil saturé | L'appareil répond en erreur de délai sous une rafale de requêtes — comportement matériel connu, ~25 ko de tas libre | L'app ne considère pas cela comme une panne : elle réessaie sans bruit et n'alerte qu'après un échec persistant. Elle **n'envoie jamais de rafale** ; les actions sont sérialisées. |
| Réponse lente | Le relais met plusieurs secondes | Aucun écran figé, aucun écran vide : l'état de chargement est distinct de l'état « pas de données ». |
| Première utilisation | L'app n'a encore jamais joint le collecteur | État d'accueil expliquant ce qu'il faut (être sur le réseau, collecteur démarré), pas un écran vide ni une erreur brute. |
| Retour de liaison | Le réseau revient | L'app se remet à jour d'elle-même, sans geste ni redémarrage. |

> **Ce qui distingue vraiment ces trois cas** : ce n'est plus l'historique — depuis la copie
> locale, il est lisible dans les trois. C'est le **rattrapage** qui tombe dans deux d'entre
> eux, et le temps réel et le pilotage dans les trois. Un écran d'état qui ne montrerait que la
> disponibilité de l'historique les rendrait indiscernables.

### B. Suivi de nuit

| Cas | Déclencheur | Comportement attendu |
| --- | --- | --- |
| Aucune nuit enregistrée | Toute première utilisation, ou historique vide | État vide explicite (« aucune nuit enregistrée pour l'instant »), pas un zéro ni une courbe plate. |
| Nuit en cours | On consulte après avoir marqué le coucher, avant le lever | La nuit est présentée **comme en cours** — durée qui court, pas d'heure de lever, aucune donnée présentée comme définitive. |
| Oubli du geste de coucher | On s'est couché sans appuyer | La nuit existe quand même si le réveil a détecté une session, avec l'heure qu'il a retenue ; sinon, la nuit est signalée sans heure de coucher, corrigeable manuellement. **Jamais d'heure inventée.** |
| Heure déduite plutôt qu'enregistrée | Le geste n'a pas été fait, et une heure existe quand même | La nuit porte la mention **« estimé »** au lieu de « confirmé ». Emprunté à SleepMapper, qui distingue les deux natures jusque dans ses graphiques — une donnée déduite ne doit jamais se présenter comme une donnée mesurée. C'est la même exigence que le trou de collecte laissé visible dans la courbe. **Ce qui produit une heure estimée n'est pas établi** : voir §6. En attendant, ne rien afficher comme confirmé qui ne vienne pas du geste, et ne rien marquer estimé sans savoir pourquoi. |
| Double appui | On appuie deux fois sur « je me couche » | La seconde pression ne crée pas une seconde nuit. L'état affiché est « suivi en cours », avec la possibilité d'annuler. |
| Appui alors que le réveil ne répond pas | Réveil débranché, carte qui redémarre, adresse changée | L'appui n'est **jamais perdu** : le collecteur retient l'heure de l'appui, qui fait foi, et ouvre la session dans le réveil dès qu'il répond — `tg2bd` ne s'écrit pas (§5, 2026-09-12). L'app affiche « coucher enregistré, en attente du réveil », **jamais** « suivi en cours » : ce qui n'est pas encore vrai ne s'affiche pas comme vrai. Voir §5. |
| Appui après-coup | On appuie à 2 h du matin alors qu'on s'est couché à 23 h | L'heure enregistrée est celle de l'appui, et elle est **corrigeable** — c'est le rôle du bouton de modification. |
| Correction incohérente | On saisit une heure de lever antérieure à l'heure de coucher | Refus avec un message clair, valeur précédente conservée. |
| Nuit à cheval sur minuit | Cas normal | La nuit est rattachée au **jour de son heure de coucher**. Une nuit ne se scinde jamais en deux. |
| Sieste ou nuit très courte | Session d'une heure | Enregistrée telle quelle, sans traitement particulier ni exclusion. L'app ne décide pas de ce qui est une « vraie » nuit. |
| Nuit très longue ou jamais close | Le lever n'a pas été marqué | La nuit reste ouverte et **visiblement anormale**, corrigeable à la main. Aucune clôture automatique silencieuse. |
| Deux nuits le même jour | Coucher, lever, recoucher | Deux sessions distinctes, toutes deux consultables. **Le réveil, lui, n'en garde qu'une** : `wungt` ne décrit que la session en cours, et un second coucher écrase le premier. C'est donc au collecteur de figer une session dès qu'elle se termine — voir la conséquence pour le backend ci-dessous. |

> **Conséquence pour le backend, à intégrer dès sa conception** : l'API locale n'ayant de
> mémoire ni longue ni multiple, le collecteur doit **écrire une session terminée dans sa base
> avant qu'une suivante ne commence**. Sans cela, une sieste suivie d'une nuit ne laisse qu'une
> trace, et le cas « deux nuits le même jour » ci-dessus est irréalisable — non par choix
> d'interface, mais parce que la donnée n'existe plus. La cadence de relevé de `wungt` décide
> donc de ce qui est perdu.

### C. Conditions de la chambre & courbes

| Cas | Déclencheur | Comportement attendu |
| --- | --- | --- |
| Nuit sans mesures | Le collecteur était arrêté cette nuit-là | La nuit s'affiche avec ses heures, et les conditions portent « pas de données ». Les deux ne dépendent pas l'un de l'autre. |
| Trous dans la collecte | Le collecteur a redémarré, la carte a perdu son WiFi, ou le réveil n'a pas répondu un moment | Le trou est **visible dans la courbe**, jamais comblé par interpolation. Une donnée absente ne doit pas ressembler à une donnée mesurée. Il porte **sa cause**, fournie par le collecteur : collecteur arrêté, carte hors réseau, réveil injoignable ou appareil saturé (§5, 2026-09-12). |
| Collecte commencée en cours de nuit | Le collecteur a démarré à 2 h | La courbe ne commence qu'à 2 h, et la période couverte est indiquée. Les minimum / moyenne / maximum portent sur ce qui a été mesuré, pas sur la nuit entière. |
| Un seul point de mesure | Nuit presque vide | La valeur s'affiche, **pas de courbe** — un point unique ne fait pas une tendance. |
| Capteur muet | Une grandeur manque alors que les autres sont là | Cette mesure seule porte « pas de données » ; les autres s'affichent normalement. Pas d'échec global. |
| Valeur aberrante | Mesure hors de toute plage physique | Affichée telle quelle. L'app ne corrige ni ne masque une mesure : elle n'est pas juge de la réalité. |
| Unités et précision | Affichage des grandeurs | Cohérence stricte avec ce que produit le capteur : une décimale pour la température, entiers pour humidité, bruit et lumière. Aucun arrondi qui invente de la précision. |
| Nuit très ancienne | On remonte loin en arrière | Chargement à la demande ; le début de l'historique est atteint sans erreur, avec un état explicite. |
| Navigation avant la première nuit | On tente de remonter au-delà du début | Action désactivée, pas d'erreur, pas d'écran vide. |

### D. Pilotage & concurrence

| Cas | Déclencheur | Comportement attendu |
| --- | --- | --- |
| Réveil piloté par sa façade | On change la lumière au bouton pendant que l'app est ouverte | L'app **reflète l'appareil**, elle ne fait pas autorité. Son affichage se remet à jour ; en cas de désaccord, l'état du réveil gagne toujours. |
| Écriture qui échoue | Une modification n'est pas prise par le réveil | Retour explicite à l'ancienne valeur affichée et message d'échec. **Jamais d'affichage optimiste** laissant croire qu'un réglage est en vigueur alors qu'il ne l'est pas — sur des alarmes, l'illusion se paie au réveil. |
| Double action rapide | On tape deux fois sur un bouton | Une seule action envoyée. Les commandes sont sérialisées ; le réveil ne supporte pas les rafales. |
| Alarme supprimée puis re-consultée | On supprime une alarme | Elle disparaît de la liste. Son emplacement reste occupé côté réveil, ce qui est sans conséquence tant qu'il est désactivé — mais **aucune alarme masquée ne doit pouvoir sonner**. |
| Plus d'emplacement disponible | Toutes les alarmes visibles sont utilisées | Message clair de limite atteinte, pas d'écrasement silencieux d'une alarme existante. |
| Réglage hors bornes | Intensité, durée, volume poussés au maximum | Bornes respectées à la saisie, jamais corrigées après coup par l'appareil. |
| Action pendant une alarme | Le réveil sonne | L'app montre l'état réel (alarme active, ou en rappel). |

### E. Copie locale, rattrapage et sauvegarde

| Cas | Déclencheur | Comportement attendu |
| --- | --- | --- |
| Première synchronisation | Application neuve devant un collecteur qui a déjà des mois d'historique | Rattrapage **par lots**, avec une progression visible et une app utilisable pendant ce temps. Les nuits récentes arrivent en premier : c'est ce qu'on regarde. |
| Rattrapage interrompu | L'app est fermée, le réseau tombe, le téléphone se met en veille | Reprise là où elle s'était arrêtée, jamais depuis le début. Ce qui est déjà copié l'est définitivement. |
| Nuit déjà connue renvoyée | Le collecteur renvoie une période que le téléphone a déjà | Aucun doublon : la nuit est remplacée par la version du collecteur, qui fait autorité. |
| Le téléphone en sait plus que le collecteur | Le collecteur a été réinstallé, ou restauré depuis une sauvegarde plus ancienne | **Le téléphone ne perd rien.** Il garde ses nuits, et signale l'écart plutôt que de s'aligner en silence. C'est le cas où le backup sert, et l'aligner sur le collecteur détruirait ce qu'on cherchait à protéger. |
| Nuit corrigée après coup | Une heure est corrigée pour une nuit que le téléphone a déjà copiée | La correction est enregistrée par le collecteur, **à côté** de la valeur relevée, jamais à sa place ; elle revient au rattrapage suivant et remplace la copie locale. La valeur relevée d'origine reste consultable. |
| Espace disque insuffisant | Le téléphone sature | Le rattrapage s'arrête proprement, l'existant reste lisible, et l'app le dit clairement au lieu d'échouer en silence. |
| Export volumineux | Plusieurs mois à exporter | La taille est annoncée avant de lancer l'export. Un export d'un an se compte en dizaines de méga-octets — assez pour que la feuille de partage rame sans prévenir. |
| Export annulé | L'utilisateur ferme la feuille de partage | Aucune action, aucun message d'erreur, et **le compteur de rappel n'est pas remis à zéro** : un export annulé n'est pas un export. |
| Rappel de sauvegarde | Du temps a passé depuis le dernier export réussi | Invite **non bloquante**, lançant l'export en un geste. Fermée sans agir, elle ne réapparaît pas à chaque ouverture — elle revient au palier suivant. |
| Fichier de sauvegarde invalide | Import d'un fichier tronqué, d'une autre app, ou d'une version future | **Refus net, données locales intactes.** Jamais d'import partiel. |
| Restauration | Import d'une sauvegarde sur un téléphone neuf | Remplacement complet et atomique, après confirmation explicite. |

### F. Temps — le risque propre à l'isolement

| Cas | Déclencheur | Comportement attendu |
| --- | --- | --- |
| Dérive de l'horloge du réveil | Une fois internet coupé, le réveil n'a plus de source de temps — il ne dispose pas de serveur de temps configurable, son heure venait de la liaison cloud | **Risque le plus concret de la coupure. Corrigé le 2026-09-13 par la mesure : il n'est PAS traitable.** L'heure du réveil ne s'écrit pas (`PUT time` refusé, `tmser`/`tmsrc` acceptés mais ignorés), et sa seule source — la session cloud — est chiffrée avec une clé non exposée (`docs/somneo-api.md` §4-5, dépôt Somneo-Scraper). **Décision : le réveil reste connecté au cloud pour l'instant** ; le cloud tient son horloge, le risque ne se matérialise pas. Le collecteur **mesure la dérive, la journalise, la signale** ; l'app affiche l'écart, ne remet jamais l'heure. L'isolement (couper le téléversement) est reporté : il ne casse que l'horloge. |
| Changement d'heure été / hiver | Passage saisonnier | Une nuit qui chevauche le changement conserve une durée juste ; aucune nuit fantôme ni dupliquée. |
| Horloges désaccordées | Le téléphone et le réveil divergent | Les heures d'une nuit proviennent d'**une seule source** — **corrigé le 2026-09-13 : celle du collecteur (NTP)**, non celle du réveil. Le collecteur date une nuit par l'instant où il observe la transition `wungt` (heure réseau), et non par la date `tg2bd` inscrite par le réveil (horloge `wutim`, 2–5 s derrière, écart variable). Les valeurs du réveil sont conservées pour la traçabilité, jamais servies comme l'heure. Un seul référentiel dans une durée. |

### G. Résumé pour le coach

| Cas | Déclencheur | Comportement attendu |
| --- | --- | --- |
| Nuit incomplète | Résumé demandé sur une nuit sans heure de lever, ou sans mesures | Le texte est produit avec ce qui existe et **dit ce qui manque**, plutôt que d'omettre en silence ou de refuser. |
| Nuit en cours | Résumé demandé avant le lever | Refusé, avec la raison : la nuit n'est pas terminée. |
| Copie effectuée | On appuie sur le bouton | Confirmation visible, texte exact affiché avant copie — on doit pouvoir relire ce qu'on va coller. |
| Copie répétée | On copie deux fois la même nuit | Aucun effet de bord, aucun marquage. L'app ne tient pas de registre de ce qui a été transmis. |

---

## 4. Critères d'acceptation

- [ ] Le réveil est isolé d'internet et le suivi de nuit **comme** les conditions de chambre
      restent consultables tous les jours.
- [ ] L'app s'ouvre sur une information utile sans attente perceptible, collecteur joignable.
- [ ] Les deux pannes — collecteur muet et réveil injoignable — produisent deux messages
      distincts, et l'historique reste lisible dans le second cas.
- [ ] Le geste « je me couche » se fait d'une main, dans le noir, et l'heure retenue est celle
      que le réveil enregistre.
- [ ] Une nuit sans mesures affiche quand même ses heures ; une nuit avec un trou de collecte
      montre le trou.
- [ ] Un réglage refusé par le réveil n'apparaît jamais comme appliqué.
- [ ] Le résumé d'une nuit se copie en un geste et se colle tel quel au coach Google Health.
- [ ] **Hors du domicile, tout l'historique reste consultable**, en lecture seule.
- [ ] **Le collecteur peut être effacé sans perte** : après une synchronisation, le téléphone
      détient l'intégralité de l'historique, et une sauvegarde exportée le restitue sur un
      téléphone neuf. C'est le seul critère qui prouve que la copie locale est un backup.
- [ ] Un rattrapage interrompu reprend là où il s'était arrêté, jamais depuis le début.
- [ ] Un collecteur réinstallé ne fait perdre aucune nuit au téléphone.
- [ ] Tous les écrans livrés sont ouverts au moins une fois par semaine trois mois après la
      livraison. Un écran non ouvert est **retiré**, pas amélioré.

---

## 5. Décisions révisées en cours de cadrage

Plusieurs arbitrages ont changé après la rédaction — deux le jour même, les autres le
lendemain — sur apport de matière nouvelle. Ils sont consignés comme **renversements**, avec ce
qui les a causés : c'est la partie utile.

### Les verdicts sur les conditions reviennent au périmètre

**Décision initiale** : les exclure, et n'afficher que des chiffres bruts. Motif — les seuils
n'étaient pas exposés par l'API locale, il aurait fallu les inventer, et afficher un jugement
sans en sourcer le seuil est plus coûteux que de se taire devant un public de chercheurs.

**Ce qui a changé** : les échelles de SleepMapper ont été relevées écran par écran. Les seuils
existent, ils sont attribuables au constructeur, ils sont désormais consignés dans
`docs/seuils-conditions-sommeil.md`. L'objection tombe — non pas parce que le besoin a changé,
mais parce que la source manquante a été trouvée.

**Décision retenue** : verdicts affichés, seuils figés, source citée. Le raisonnement initial
reste valable et s'applique toujours à tout seuil qu'on ne saurait pas sourcer.

### La copie locale entre au périmètre — 2026-09-06

**Décision initiale** : exclure toute sauvegarde depuis l'application, au motif que « la
mémoire vit dans la base du collecteur, pas dans le téléphone ». La phrase était juste et la
conclusion fausse : c'est précisément *parce que* la mémoire ne vit qu'à un seul endroit
qu'une copie s'impose. J'avais décrit le défaut et conclu qu'il fallait le laisser.

**Ce qui a changé** : rien de neuf n'a été découvert — le fait était écrit dans le cadrage dès
le premier jour (« la base SQLite du collecteur est la seule mémoire qui existe »). Ce qui
manquait, c'était d'en tirer la conséquence.

**Décision retenue** : copie locale complète et indéfinie, plus un export vers le Drive. En
prime, cela **supprime** le besoin qui motivait l'accès distant, au lieu de le traiter : les
données sont déjà dans la poche, le collecteur n'a jamais à sortir du réseau domestique.

### Les vues agrégées entrent au périmètre — 2026-09-06

**Décision initiale** : les exclure. Motif — « c'est exactement la forme de l'onglet Stats de
Commit & Push », cadré, construit, jamais ouvert. L'analogie paraissait décisive.

**Ce qui a changé** : le relevé des écrans Semaine et Mois de SleepMapper. Ils ne sont pas
l'équivalent de l'onglet Stats, et l'analogie était paresseuse. L'onglet Stats empilait six
indicateurs dérivés d'un historique (records, régularité, moyennes) — des chiffres *sur* la
donnée. Les vues de SleepMapper montrent **la donnée elle-même, autrement** : l'axe vertical
est l'heure de la journée, chaque barre est la plage de sommeil, et ce que l'œil y lit est la
**régularité des horaires** — une chose qu'aucune consultation nuit par nuit ne peut montrer.

C'est une vue, pas une statistique. Et c'est un geste déjà accompli, puisque ces écrans
existent dans l'application utilisée aujourd'hui.

**Décision retenue** : vues Semaine et Mois, plus l'historique en calendrier, au périmètre.
La règle cardinale n'est pas affaiblie — elle est appliquée correctement : la question n'a
jamais été « est-ce que ça ressemble à des stats ? » mais « est-ce que ça correspond à un
geste réel ? ».

### La direction artistique « liquid glass » est écartée — 2026-09-06

**Décision initiale** : explorer le « liquid glass », volontairement, comme nouveauté par
rapport aux projets précédents.

**Ce qui a changé** : l'épreuve demandée par le cadrage lui-même — l'essayer sur un écran réel
avant de l'appliquer partout. Deux raisons l'ont fait tomber, et la seconde est propre à ce
projet : **un fond de nuit uni ne donne rien à réfracter**, l'effet n'a donc pas de matière ; et
**la lumière émise par l'écran pollue le capteur que l'application exploite** — une interface
lumineuse consultée au lit fausse la mesure de luminosité de la nuit qu'elle affiche.

**Décision retenue** : direction sobre — fond de nuit en dégradé, cartes à peine détachées, une
seule couleur d'accent, le chiffre comme élément porteur. Les exigences qui encadraient
l'exploration ne changent pas : lisibilité d'abord, crédibilité professionnelle.

### Le réveil sera remis à l'heure automatiquement

> **Renversé le 2026-09-13 par la mesure.** Ce qui suit reposait sur « l'heure du réveil est
> inscriptible » — c'est faux. Trois voies épuisées : `PUT products/0/time` refusé (500/500),
> `wutms.tmser`/`tmsrc` acceptés mais jamais appliqués, et la session cloud qui pose l'heure est
> chiffrée (AES/CB-Encrypted) avec une clé que le port `security` ne fournit pas (dérivée au
> provisioning). Forger l'heure demanderait de rétro-concevoir la crypto CPP : écarté.
> **Décision effective : le réveil reste connecté au cloud** (qui tient son horloge) ; le
> collecteur **mesure, journalise et signale** la dérive sans jamais l'écrire, et sert à l'app
> l'heure corrigée. L'isolement — l'objet du projet — est un interrupteur reporté : il ne casse
> que l'horloge, tout le reste étant local. Détail : `docs/somneo-api.md` §4-5 (Somneo-Scraper).
> Le titre de cette section est conservé pour la mémoire du processus ; le fond est caduc.

**Question posée** : l'application peut-elle donner l'heure au réveil ?

**Réponse** : oui — l'heure du réveil est inscriptible, c'est un des rares points où
l'isolement se répare au lieu de se subir. Mais **ce n'est pas le rôle de l'application** :
elle n'est ouverte que par intermittence, alors que la dérive court en continu. Le collecteur,
lui, fonctionne sans interruption, dispose d'une heure réseau juste et parle déjà à l'appareil.

**Décision retenue** : la remise à l'heure est **une fonction du collecteur**, périodique et
silencieuse. L'application n'écrit jamais l'heure ; elle se contente de **signaler un écart**
s'il devient visible. Décision touchant le contrat entre les deux projets — **à reporter dans
les deux notes Obsidian et dans l'`AGENTS.md` de Somneo-Scraper**, où elle devient une exigence
du backend.

### La correction d'une nuit passée ouvre la seule porte d'écriture — reportée le 2026-09-12

**Décision initiale** : « le téléphone n'écrit jamais dans la mémoire », **sans exception**
(§2.C, 2026-09-06).

**Ce qui a changé** : le cadrage du backend (2026-09-06, dépôt Somneo-Scraper, §5) a relevé
la contradiction. Ce document prévoit de corriger les heures de n'importe quelle nuit (§2.B) ;
or `wungt` ne tient que la session en cours, et corriger une nuit d'avant-hier via le réveil
est impossible. Les deux règles ne pouvaient pas être vraies ensemble.

**Décision retenue** : le collecteur accepte la correction d'heure, l'enregistre **à côté** de
la valeur relevée sans jamais l'écraser, et sert les deux. La règle devient « le téléphone
n'écrit jamais dans la mémoire, **sauf une correction d'heure, tracée et réversible** ». Rien
d'autre ne change : pas d'écriture en masse, pas de repeuplement d'un collecteur neuf, et la
synchronisation reste unidirectionnelle pour tout le reste. Une porte étroite et nommée vaut
mieux qu'une règle absolue qu'on enfreindrait en silence.

Décidée le 6, elle était restée dans le dépôt du backend : reportée ici le 2026-09-12.

### Un appui « je me couche » n'est jamais perdu — reporté le 2026-09-12

**Question posée au cadrage du backend** : que faire quand le geste est fait alors que le
réveil ne répond pas ?

**Décision retenue** : le collecteur retient l'heure de l'appui et ouvre la session dans le
réveil dès qu'il répond. **Précisé le 2026-09-12 par la mesure** (dépôt Somneo-Scraper, sonde
P1) : le réveil n'accepte pas d'heure passée — `tg2bd` ne s'écrit pas, il date la session de
l'instant où il la reçoit. L'heure de l'appui vit donc dans le collecteur, qui fait autorité. Le geste est la seule chose que l'utilisateur produit lui-même ; le perdre parce
qu'une carte redémarrait serait le pire échec possible, sur la fonction la plus simple.

**Ce que cela impose ici** : un état d'interface de plus, absent des maquettes — « coucher
enregistré, en attente du réveil », **jamais** « suivi en cours ». La règle « aucun affichage
optimiste » n'est pas levée : elle est appliquée. **Les maquettes restent à compléter**
(`design/Main.dc.html`, suivi du coucher).

### Trois points du contrat précisés par le plan du collecteur — 2026-09-12

Tranchés par Victor en validant le plan technique du collecteur (dépôt Somneo-Scraper,
`.claude/specs/2026-09-12-plan-technique-collecteur.md`, §11), et reportés le jour même dans son
cadrage (§5).

- **Le rattrapage se fait par numéro de séquence, pas par date.** « Depuis telle date » ne
  ramenait pas une nuit ancienne corrigée après copie, que §3.E exige pourtant de remplacer.
  Première synchronisation en reculant nuit par nuit, les récentes d'abord ; ensuite, « tout ce
  qui a été créé ou modifié depuis le numéro n ».
- **Un trou de collecte porte l'une de quatre causes**, fournie par le collecteur : collecteur
  arrêté, carte hors réseau, réveil injoignable, appareil saturé. La deuxième est nouvelle : le
  WiFi de la carte tombe souvent, et la fondre dans « réveil injoignable » accuserait le réveil
  à tort.
- **L'app trouve le collecteur par mDNS, sous `_somneo-scraper._tcp`.** C'est la réponse à la
  question du §6.

---

## 6. Questions ouvertes / à trancher

- [ ] **Seuil du rappel de sauvegarde.** Compté en jours, en nuits accumulées, ou en volume
      non exporté ? Commit & Push compte en séances ; ici la donnée arrive toute seule, sans
      geste, donc un compte en jours est probablement plus juste.
- [ ] **`lgtds`, champ de lumière du profil d'alarme.** Listé par la rétro-ingénierie sans que
      son sens ait été établi. À vérifier sur l'appareil avant de décider s'il a sa place dans
      l'écran d'alarme — il est pour l'instant hors périmètre par défaut d'information.
- [x] **Bornes et unités des réglages d'alarme ajoutés.** ~~Restent à relever.~~ **Relevées
      le 2026-09-06** dans SleepMapper et consignées dans `docs/sleepmapper/README.md` : durée
      du lever 5–40 min, durée du coucher de soleil 5–60 min, intensité 1–25 au lever et 0–25
      au coucher, volume 1–25, durée du rappel 1–20 min. **Ne pas les uniformiser** : un lever
      de soleil ne peut pas être éteint, un coucher de soleil le peut.
- [ ] **Qui marque la fin de nuit, et d'où vient une heure « estimée » ?** Le geste de coucher
      est décidé (bouton dans l'app, écriture dans le réveil), le geste de lever ne l'est pas :
      arrêt de l'alarme, appui sur la façade, ou correction manuelle a posteriori. La même
      incertitude commande la mention **« estimé »**, reprise de SleepMapper sans que sa règle
      de production y ait été relevée — et elle ne le sera plus, l'application se videra.
      Une seule chose est sûre : une heure issue du geste est **confirmée**. Le reste est
      ouvert, et deux pistes s'excluent mal :
      - le **réveil déduit** lui-même une mise au lit de ses capteurs — bruit, lumière,
        mouvement dans la pièce — et remplit `tg2bd` / `tendb` sans que l'app ait rien écrit ;
      - ou l'inférence vivait dans le **cloud Philips**, et disparaît avec lui.

      À établir **sur l'appareil, au cadrage du backend** : c'est le collecteur qui verra la
      différence entre une heure qu'il a provoquée et une heure qu'il a trouvée ; l'app ne fait
      que restituer l'étiquette. **Une correction manuelle ne produit pas « estimé »** — c'était
      une supposition, elle est retirée. Tant que ce n'est pas tranché, la maquette laisse la
      mention à ce que le collecteur renvoie et n'en fabrique aucune.
- [ ] **Contenu exact du résumé pour le coach.** Proposition à valider — date de la nuit,
      heure de coucher, heure de lever, temps au lit, puis pour chaque grandeur le minimum, la
      moyenne et le maximum. Reste à décider si le texte est **modifiable** comme dans
      Commit & Push, ou figé (le rendre modifiable ajoute un écran de réglages : à ne faire que
      si le besoin apparaît).
- [x] **Comment l'app trouve le collecteur.** ~~Découverte automatique, ou adresse saisie une
      fois ?~~ **Tranché** : découverte automatique par mDNS (cadrage du backend, 2026-09-06),
      sous le service `_somneo-scraper._tcp` (2026-09-12, §5). Aucune adresse en dur.
- [ ] **Profondeur d'historique navigable.** Jusqu'où peut-on remonter, et que se passe-t-il
      quand la base du collecteur devient volumineuse ? Peut rester ouvert jusqu'au cadrage du
      backend, mais doit être tranché là.
- [x] **Direction artistique.** ~~Le « liquid glass » doit être éprouvé sur un écran réel.~~
      **Tranché le 2026-09-06** : éprouvé, puis écarté. Voir le renversement en §5.

---

## Suite

1. **Maquettes** des écrans retenus, sur la base de `docs/sleepmapper/` pour l'UX et de la DA
   à explorer. Livrable de conception, à valider avant toute ligne de code.
2. **Cadrage puis écriture du backend** ([Somneo-Scraper]), dont l'API doit répondre à ce
   document et à rien d'autre.
3. **Contributions à `pysomneo`**, après construction et non avant.

> Ce cadrage peut alimenter un plan technique. Penser à mettre à jour la note Obsidian
> `Projets/SleepMaxxer.md` au jalon — et à y corriger l'avertissement « le dépôt n'existe pas
> encore », devenu faux.

[Somneo-Scraper]: https://github.com/VictorLabeille/Somneo-Scraper
