# Seuils des conditions de sommeil

> Relevés dans SleepMapper le **5 septembre 2026**, sur les écrans de détail de chaque mesure
> (section « Informations »). Captures de référence : `docs/sleepmapper/07-` à `14-`
> (non versionnées, voir le README de ce dossier).
>
> Ce sont les seuils du **constructeur**, pas une invention du projet. C'est ce qui autorise
> SleepMaxxer à porter un jugement sur une mesure : la source est identifiable et citable, ce
> qui n'était pas le cas au moment du cadrage initial.

## Pourquoi ce document existe

Le cadrage du 2026-09-05 avait d'abord **exclu** les verdicts qualitatifs, au motif qu'ils
supposaient des seuils que l'API locale n'expose pas et qu'il aurait fallu inventer — un
jugement non sourcé étant plus coûteux que pas de jugement du tout devant un public de
chercheurs. Les captures de ces échelles lèvent l'objection : les seuils existent, ils sont
relevés, ils sont attribuables. **La décision a été inversée le jour même.**

Ces seuils ne sont exposés par aucun port de l'API locale du réveil. Ils vivent dans
l'application constructeur. Une fois SleepMapper désinstallée, **ce document est la seule
trace qui en reste** — au même titre que `docs/sleepmapper/`.

## Deux familles d'échelles

La distinction commande la façon de restituer chaque mesure, et il ne faut pas l'aplatir :

- **Température et humidité — échelles à cinq bandes, symétriques.** Il existe un trop peu et
  un trop, de part et d'autre d'une plage idéale. Chaque bande porte un **jugement**.
- **Lumière et bruit — échelles à un seul seuil, ouvertes vers le haut.** L'idéal est le
  minimum ; au-dessus du seuil, SleepMapper ne juge plus, il **compare à des situations
  connues** (« bibliothèque municipale », « crépuscule »). Ces libellés sont des repères
  d'échelle, pas des verdicts.

## Température (°C)

| De | À | Libellé |
| --- | --- | --- |
| 22 | — | Trop chaud |
| 19 | 22 | Chaud |
| **17** | **19** | **Conditions de sommeil idéales** |
| 14 | 17 | Froid |
| — | 14 | Trop froid |

Texte d'accompagnement de l'application : « L'identification de votre température idéale de
sommeil est un sujet très personnel. Certaines personnes aiment dormir dans une chambre chaude,
d'autres la préfèrent plus fraîche. Les recherches montrent cependant que votre sommeil peut
être perturbé lorsque votre environnement est trop chaud ou trop froid. »

## Humidité (%)

| De | À | Libellé |
| --- | --- | --- |
| 70 | — | Trop humide |
| 60 | 70 | Humide |
| **40** | **60** | **Conditions de sommeil idéales** |
| 30 | 40 | Sec |
| — | 30 | Trop sec |

Texte d'accompagnement : « Un niveau adapté d'humidité dans votre chambre vous permettra de
mieux dormir, mais aussi apaisera les éventuels symptômes d'un rhume et des allergies, comme la
sécheresse du nez et le mal de gorge. Soyez vigilant malgré tout, car un environnement très
humide est gênant et peut entraîner la formation de moisissures toxiques dans votre chambre. »

## Lumière (lux)

Échelle **logarithmique**, un seul seuil de qualité.

| De | À | Libellé |
| --- | --- | --- |
| **0** | **10** | **Conditions de sommeil idéales** |
| 10 | 40 | Crépuscule |
| 40 | 200 | Lampe de poche |
| 200 | 500 | Accueil |
| 500 | 1 000 | Site |
| 1 000 | 10 000 | Centre commercial |
| 10 000 | — | Lumière du jour |

Texte d'accompagnement : « Les très faibles niveaux de lumière, comme celle des éclairages
publics à travers les rideaux, peuvent atteindre plus de 40 lux. Même s'ils ne vous réveilleront
pas nécessairement, la qualité de votre sommeil peut en être affectée. »

## Bruit (dB)

Un seul seuil de qualité ; au-delà, des repères par tranches de 10 dB.

| De | À | Libellé |
| --- | --- | --- |
| **0** | **30** | **Conditions de sommeil idéales** |
| 30 | 40 | Bibliothèque municipale |
| 40 | 50 | Ville la nuit |
| 50 | 60 | Rue à faible trafic |
| 60 | 70 | Voix normales |
| 70 | 80 | Aspirateur |
| 80 | 90 | Route passante |
| 90 | 100 | Mixeur ménager |
| 100 | 110 | Survol d'avion |
| 110 | 120 | Groupe de rock |
| 120 | — | Marteau-piqueur |

Texte d'accompagnement : « Même si le vent soufflant dans les feuilles peut constituer un bruit
ambiant agréable la nuit, votre climatisation, vos voisins rentrant chez eux ou tout autre bruit
d'un volume supérieur à 40 dB peuvent facilement perturber votre sommeil. »

> Noter la nuance : le seuil d'affichage est à **30 dB**, mais le texte désigne **40 dB** comme
> le niveau à partir duquel le sommeil est perturbé. Les deux chiffres coexistent dans
> l'application, sans contradiction — 30 dB borne l'idéal, 40 dB borne le tolérable.

## Ce que SleepMaxxer en fait

- Les seuils sont **figés dans l'application** et documentés ici. Aucun écran de réglage : les
  rendre modifiables ajouterait une surface pour un besoin qui ne s'est pas manifesté.
- Le verdict accompagne la mesure sur l'écran des conditions, et la plage recommandée est
  **tracée en fond de la courbe** sur l'écran de détail — c'est ce que fait SleepMapper, et
  c'est ce qui rend la courbe lisible sans légende.
- **Toujours citer la source du seuil** dans l'app ou sa documentation. C'est ce qui distingue
  un verdict d'une opinion, et c'est le point sur lequel le cadrage avait buté.
- Pour la lumière et le bruit, ne **pas** transformer les repères descriptifs en jugements.
  Écrire « équivalent à une bibliothèque municipale », jamais « bruit acceptable ».
