# SleepMapper — relevé de l'interface

> Captures prises le **5 septembre 2026**, sur SleepMapper (`com.philips.src.hss`) encore
> connectée au cloud Philips, avec le Somneo HF3671/01 en service.
>
> **Pourquoi ce dossier existe.** Une fois le réveil isolé d'internet, les écrans d'historique
> de SleepMapper se videront : ils sont alimentés par la synchronisation HealthSuite, pas par
> l'API locale (voir `docs/somneo-api.md` du dépôt Somneo-Scraper, §5). Ces captures sont donc
> la **seule trace** de l'interface qu'on remplace, et elles ne seront pas reproductibles.
> Elles servent de référence d'UX pour SleepMaxxer, qui doit rester familier plutôt que
> dépayser son unique utilisateur.

## Les images ne sont pas versionnées — ce document les remplace

Les captures montrent un **rythme de sommeil réel** et les **conditions d'une chambre**
identifiable. Le dépôt étant public, elles sont exclues par le `.gitignore` et **restent en
local uniquement**. Ce qu'elles apprennent est donc transcrit ici par écrit, et c'est ce
document qui est versionné.

Conséquence pratique : sur une machine fraîchement clonée, `docs/sleepmapper/` ne contient que
ce fichier. Ne pas s'en étonner et ne pas chercher à regénérer les images — elles ne sont pas
reproductibles.

## Navigation générale

Quatre onglets en barre basse : **Mon Appareil** · **Mon** (« Mon Sommeil ») · **Conseils** ·
**Plus**. Seuls les deux premiers sont utilisés — *Conseils* est du contenu éditorial générique,
*Plus* des paramètres de compte. SleepMaxxer ne reprend que les deux premiers.

| Fichier | Écran | Rôle |
| --- | --- | --- |
| `01-mon-appareil-haut.png` | Mon Appareil (haut) | Vignette d'appareil + état de connexion, sections « Préparez-vous à dormir » et « S'endormir » |
| `02-mon-appareil-bas.png` | Mon Appareil (bas) | Section « Télécommande » : suivi de coucher, intensité lumineuse, radio FM, réglages d'afficheur |
| `03-alarmes-liste.png` | Alarmes | Liste des alarmes visibles, avec PowerWake |
| `04-coucher-de-soleil.png` | Coucher de soleil | Minuteur circulaire et lancement |
| `05-mon-sommeil-temps-au-lit.png` | Mon Sommeil › Temps au lit | Durée au lit d'une nuit, heures de coucher et de réveil |
| `06-mon-sommeil-conditions-chambre.png` | Mon Sommeil › Conditions de la chambre | Les quatre mesures, **assorties d'un verdict** |
| `07-` / `08-detail-temperature-*` | Détail › Température | Courbe puis échelle des seuils |
| `09-` / `10-detail-humidite-*` | Détail › Humidité | Idem |
| `11-` / `12-detail-lumiere-*` | Détail › Lumière | Idem, échelle logarithmique |
| `13-` / `14-detail-bruit-*` | Détail › Bruit | Idem |

## Écran « Mon Appareil » — pilotage

En-tête centré sans bouton retour. Vignette du produit surmontée d'une **pastille verte de
connexion** : c'est le seul indicateur d'état de liaison de l'application.

Le contenu est découpé en **sections titrées en minuscules**, chacune portant des cartes :

- **Préparez-vous à dormir** → une carte pleine largeur *Alarmes* (icône + libellé centrés).
- **S'endormir** → deux cartes à parts égales, *RelaxBreathe* et *Coucher de soleil*.
- **Télécommande** → cartes hétérogènes :
  - *Suivi de l'heure de coucher*, avec une icône de lune, un « i » d'aide et un bouton plein
    **« Démarrer le suivi »**. C'est le geste de mise au lit — un bouton dans l'app, pas sur
    l'appareil.
  - *Intensité lumineuse*, réduite à un **interrupteur** quand la lampe est éteinte ; le
    réglage de niveau n'apparaît qu'une fois allumée.
  - *Radio FM*, carte du même gabarit que celles de « S'endormir ».
  - *Afficher*, carte de résumé en lecture : « Affichage toujours actif – Arrêt » et
    « Luminosité de l'écran – 1 ».

Enseignement de forme : **une carte par fonction, jamais de réglage détaillé sur l'accueil.**
Le détail vit derrière la carte. C'est ce qui garde cet écran lisible malgré sept fonctions.

## Écran « Alarmes »

En-tête à trois zones : `‹` retour, titre, `+` d'ajout. Chaque ligne porte l'heure en très
grand, la récurrence en dessous (« Jours de la semaine », « Tous les jours ») et un
interrupteur à droite. Une alarme désactivée est **grisée en entier**, heure comprise —
l'état se lit sans chercher l'interrupteur.

Le **PowerWake** apparaît en haut à droite de la ligne : icône d'éclair et heure, sans libellé. Il n'est montré que s'il est armé.

Deux alarmes seulement sont listées. Le réveil en tient **seize** en mémoire ; les autres ne
sont pas affichées parce qu'elles sont marquées non visibles, pas parce qu'elles n'existent
pas (champs `prfvs` / `prfen`, voir `somneo-api.md` §4). Le `+` rend un emplacement visible.

## Écran « Coucher de soleil »

En-tête `‹` · titre · **« Modifier »** (le réglage détaillé est derrière ce lien, pas sur
l'écran). Le corps est un **grand disque lumineux** portant l'icône de la fonction, la durée en
très grands chiffres et son unité. Un halo diffus l'entoure — c'est le seul effet lumineux de
l'application, et il est réservé à ce qui compte. Bouton plein **« Démarrer »** en bas.

## Écran « Mon Sommeil »

Deux onglets soulignés en accent : **Temps au lit** et **Conditions de la chambre**.

### Temps au lit

Barre de sélection : icône de calendrier + date (`sept. 05, 2026`) à gauche, granularité
(`Jours ▾`) à droite. Puis le **même disque** que le coucher de soleil, ici cerclé d'un trait
plein portant la durée en heures et minutes, légende « Temps au lit ».

En dessous, deux **pilules** côte à côte, *Heure de coucher* et *Heure de réveil*, chacune portant son
horaire et marquée d'une **pastille rouge** — signalement d'une valeur à confirmer ou
saisie manuellement. Un bouton **« Modifier »** permet de les corriger.

### Conditions de la chambre

Titre **« Maintenant »**, puis une carte unique découpée en quatre lignes, une par mesure :
température, humidité, lumière, bruit. Chaque ligne porte, de gauche à droite :

1. une **icône d'état** — orange avec un `!` quand la valeur sort de la plage de sommeil,
   blanche et neutre quand elle est bonne ;
2. le **nom de la mesure** ;
3. une **phrase de verdict** — « La température de la chambre est trop élevée »,
   « Hygrométrie de sommeil optimale », « La lumière dans la chambre est trop vive »,
   « Le niveau sonore est trop élevé » ;
4. la **valeur et son unité** en grand — une décimale pour la température,
   entiers pour l'humidité, la lumière et le bruit ;
5. un **chevron** menant au détail de la mesure.

C'est le point le plus important de tout ce relevé : **SleepMapper ne montre pas des chiffres,
il les juge.** La valeur d'usage tient dans la phrase, pas dans la mesure — un utilisateur qui
lit une température brute ne sait pas quoi en faire, celui qui lit « trop élevée » ouvre la fenêtre.

Les seuils qui produisent ces verdicts ne sont **pas** exposés par l'API locale du réveil : ils
vivent dans l'application constructeur. Ils ont été relevés sur les écrans de détail et sont
consignés dans **`docs/seuils-conditions-sommeil.md`** — sans quoi ils auraient disparu avec
SleepMapper.

## Écran de détail d'une mesure

Atteint par le chevron d'une ligne de « Conditions de la chambre ». En-tête : titre de la
grandeur et une croix de fermeture ; en dessous, un `‹` de retour, la **période couverte**
(deux dates) et la mention « Dernière mise à jour : … ».

Le corps est un **graphique unique**, titré par la grandeur et son unité (« Température moyenne
(°C) », « Hygrométrie moyenne (%) », « Luminosité moyenne (lux) », « Niveau sonore moyen (dB) »).
Trois choses le composent :

1. la **courbe de la mesure** — un trait fin blanc pour la température et l'humidité, une
   **aire remplie** pour la lumière et le bruit ;
2. la **plage recommandée tracée en fond**, en bande horizontale d'accent, avec un dégradé qui
   s'estompe vers ses bords plutôt qu'une bordure nette. C'est elle qui rend la courbe lisible
   sans qu'on ait à connaître les seuils ;
3. une **légende à deux entrées** : « … dans votre chambre » (le trait) et « … recommandé·e »
   (la bande).

L'axe des ordonnées est **linéaire** pour la température, l'humidité et le bruit, mais
**logarithmique pour la lumière** (0, 5, 10, 40, 200, 500, 1 000, 10 000) — sans quoi une
chambre nocturne serait écrasée sur la ligne du bas. L'axe des abscisses couvre une fenêtre
d'une dizaine d'heures, graduée toutes les deux heures.

Vient ensuite un bouton **« Sync. maintenant »** — la synchronisation cloud, sans objet dans
SleepMaxxer et à ne pas reprendre.

Enfin une section **« Informations »** : l'**échelle des seuils** dessinée en réglette
verticale, chaque tranche étiquetée, la tranche idéale seule en couleur d'accent, puis un
paragraphe pédagogique expliquant pourquoi cette grandeur compte pour le sommeil. Le détail
chiffré de ces échelles est dans `docs/seuils-conditions-sommeil.md`.

## Listes et bornes relevées — thèmes lumineux et sons

Relevé le 6 septembre 2026 (captures `16-` à `18-`). Ces listes ne sont exposées par aucun
port de l'API : elles vivent dans l'application constructeur et disparaîtront avec elle.

### Jeux de couleur — la même liste des deux côtés

| Nom | Dégradé (haut → bas) |
| --- | --- |
| Sunny day | orange doré → crème |
| Island red | orange vif → crème |
| Nordic white | kaki clair → crème pâle |
| Caribbean red | rouge orangé → orange |

Ils sont présentés en **liste avec pastille ronde et coche**, pas en menu déroulant — la
couleur se choisit à l'œil, jamais par son nom.

> **Une seule différence entre les deux écrans** : le lever de soleil d'une alarme propose une
> cinquième entrée, **« No light »** (réveil au son seul), absente du coucher de soleil.

### Bornes des réglages — elles diffèrent d'un écran à l'autre

| Réglage | Écran | Bornes |
| --- | --- | --- |
| Durée | Soleil (lever d'alarme) | **5 – 40 min** |
| Durée | Coucher de soleil | **5 – 60 min** |
| Intensité lumineuse | Soleil (lever d'alarme) | **1 – 25** |
| Intensité lumineuse | Coucher de soleil | **0 – 25** |
| Volume | Choix du son | **1 – 25** |
| Durée du rappel | Alarme (global) | **1 – 20 min** |

Ne pas uniformiser : un lever de soleil ne peut pas être éteint (minimum 1), un coucher de
soleil le peut (minimum 0), et leurs durées maximales ne sont pas les mêmes.

### Sons d'alarme

Dans l'ordre de l'écran « Choisissez un son », **volume en tête de liste** puis les entrées :
FM radio (avec chevron, mène aux stations) · Forest Birds · Summer Birds · Buddha Wakeup ·
Morning Alps · Yoga Harmony · Nepal Bowls · Summer Lake · Ocean Waves · No sound.

### Sons du coucher de soleil — liste propre, différente de celle de l'alarme

Section « Sons ambiants », dans l'ordre : **No sound · FM radio › · Soft Rain · Ocean Waves ·
Under Water · Summer Lake**, puis le **volume (1 – 25) en bas de page**, après la liste.

Deux écarts avec l'écran de son d'une alarme, à ne pas uniformiser :

- **Les listes diffèrent.** Le coucher de soleil propose quatre ambiances de fond (pluie, mer,
  sous l'eau, lac) ; l'alarme propose huit sons de réveil (oiseaux, cloches, montagne). Aucun
  n'est commun aux deux hormis *Ocean Waves* et *Summer Lake*.
- **Le volume n'est pas au même endroit** : en tête de l'écran de son d'une alarme, en pied de
  l'écran du coucher de soleil. La liste est inline ici, dans un sous-écran là.

### Historique — un calendrier mensuel

L'icône de calendrier, à gauche de la date dans « Mon Sommeil », ouvre un écran plein
**« Historique »** avec une croix de fermeture. Il porte :

- un **sélecteur de métrique** en tête (« Temps au lit ▾ ») — les conditions de chambre s'y
  consultent donc aussi, en calendrier ;
- une navigation **mois par mois** (`‹ août 2026 ›`) ;
- une **grille calendaire** lundi → dimanche, chaque jour portant une **pastille ronde avec la
  durée** (`7:57`, `9:01`, `8:35`…) ;
- un jour sans donnée porte une **pastille sombre et vide** — la case n'est jamais absente,
  l'absence est dessinée ;
- la même distinction qu'ailleurs, en légende : **pastille blanche pleine = confirmé**,
  **pastille à contour orange pointillé = estimé**.

> **Un détail non élucidé** : deux jours du relevé (28 et 31 août) portent une pastille
> **grise pleine**, absente de la légende. Ce sont les deux durées les plus courtes du mois,
> mais rien ne permet de l'affirmer. À vérifier avant de reproduire ce code couleur — ne pas
> l'inventer.

### Choix des jours d'une alarme

Écran « Répéter le », question en tête : « Quels jours voulez-vous répéter votre alarme ? »
Puis les **sept jours en liste, chacun à cocher** — lundi à dimanche, aucun raccourci
« jours ouvrés » ni « week-end ». Les libellés de la liste d'alarmes (« Jours de la semaine »,
« Tous les jours ») sont donc **déduits** de la combinaison cochée, pas choisis.

### Temps au lit — état vide, et la distinction qui compte

Quand aucune nuit n'est disponible, le disque affiche `-- --` à la place de la durée, suivi de :
« Aucune heure de coucher ou de réveil n'est disponible. Veuillez ajouter manuellement vos
données de sommeil. » et d'un bouton **Ajouter**. L'écran ne se vide donc jamais : il propose
la saisie manuelle.

**Le point le plus important de tout ce relevé après les verdicts** : les vues agrégées
distinguent deux natures de donnée en légende — **« Temps au lit confirmé »** (barre pleine) et
**« Temps au lit estimé »** (barre hachurée orange). Une nuit dont les heures ont été
enregistrées explicitement ne se présente pas comme une nuit déduite. C'est la réponse
d'interface au cas de l'oubli du geste de coucher, et elle vaut d'être reprise.

### Vues agrégées — hors périmètre de SleepMaxxer

Le sélecteur de période propose **Jours · Semaine · Mois**. Les deux dernières produisent :

- un bandeau de comparaison (« Durée moyenne passée au lit 07 hr 50 min ↓ · inférieure à la
  moyenne de la semaine dernière de 08 hr 08 min ») ;
- un **graphique en barres dont l'axe vertical est l'heure de la journée** (12:00 → 12:00), si
  bien que chaque barre montre la *plage* de sommeil et non sa seule durée — la régularité des
  horaires se lit d'un coup d'œil ;
- une icône d'export en haut à droite.

C'est bien conçu, et c'est **exclu du périmètre** : le cadrage ne retient que la navigation
nuit par nuit. La forme est notée ici au cas où le besoin se manifesterait un jour — pas comme
une intention.

### Un bouton propre au lever de soleil

L'écran « Soleil » se termine par **« Test sur l'appareil »** — il joue l'aperçu sur le réveil
plutôt que sur le téléphone. Cohérent avec un réglage dont l'effet ne se juge que dans la pièce.

## Langage visuel

- **Fond** : bleu nuit très sombre, en dégradé vertical léger, plus clair en haut. Les cartes
  sont un aplat à peine détaché du fond, sans bordure — la séparation vient du contraste, pas
  du trait.
- **Accent unique** : un vert-bleu (teal) saturé, employé pour les boutons pleins, les
  interrupteurs actifs et le soulignement d'onglet. Rien d'autre n'est coloré.
- **Alerte** : un orange chaud, réservé aux icônes d'état hors plage.
- **Typographie** : une linéale humaniste légèrement arrondie, en graisse fine, avec des
  **chiffres très grands** comme élément porteur de chaque écran.
- **Densité** : faible. Beaucoup de vide, peu d'éléments par écran, aucune donnée secondaire.

Ces choix sont à retenir dans leur **intention** — sobriété, une seule couleur d'accent,
le chiffre comme héros, le verdict avant la mesure — pas dans leur exécution : SleepMaxxer
explore une direction artistique distincte.
