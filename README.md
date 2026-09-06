# SleepMaxxer

Application Android qui remplace **SleepMapper**, l'application constructeur du réveil
**Philips Somneo HF3671/01**, pour permettre de couper l'accès internet de l'appareil sans
rien perdre de ce qui sert au quotidien.

Front-end du projet. Le back-end est
[Somneo-Scraper](https://github.com/VictorLabeille/Somneo-Scraper), qui collecte, historise et
relaie.

Stack prévue : **Expo** · React Native · TypeScript.

> **État : cadrage fonctionnel validé, maquettes livrées, code non commencé.**
> Prochaine étape : le cadrage puis l'écriture du backend, dont l'API doit répondre à ce que
> les maquettes demandent.

## Pourquoi

Le Somneo est en permanence connecté aux serveurs Philips, et SleepMapper est lente à démarrer
et encombrée de fonctions inutilisées. Mais le point décisif n'est pas le confort.

La rétro-ingénierie menée le 31 août 2026 a établi que **l'API locale du réveil n'a aucune
mémoire** : elle ne donne que l'instant présent, la fenêtre d'agrégation de 15 minutes en cours
et la nuit en cours. Les courbes d'historique de SleepMapper viennent du cloud Philips, que le
réveil alimente lui-même.

**Couper internet supprime donc la fonction principale de l'application constructeur.** Isoler
le réveil n'est possible qu'à condition de posséder d'abord son propre historique et sa propre
télécommande. SleepMaxxer n'est pas un confort : c'est la condition de l'isolement.

S'y ajoute un constat d'hygiène : le réveil n'applique **aucun contrôle d'accès sur le réseau
local**. Le port qui livre sa clé de sécurité et celui qui déclenche une réinitialisation
d'usine répondent à quiconque se trouve sur le LAN.

## Architecture

```
Somneo HF3671/01  ←→  Somneo-Scraper (Radxa Zero, 24/7)  ←→  SleepMaxxer
   API locale            collecte · historise · relaie        (ce dépôt)
   sans mémoire          SQLite — la source                    copie locale
                                                               + export Drive
```

- L'application **ne parle jamais au réveil directement** : tout passe par le collecteur,
  historique comme temps réel comme pilotage.
- Le collecteur et le téléphone sont sur le **même réseau domestique**. Aucune exposition vers
  l'extérieur.
- Le téléphone **conserve une copie complète de l'historique**, rattrapée à chaque ouverture.
  Elle sert de sauvegarde — le collecteur est sinon le seul dépositaire d'une donnée qui ne se
  remesure pas — et rend l'historique consultable hors du domicile, en lecture seule, sans que
  le collecteur ait à sortir du réseau. Le collecteur reste la source : en cas de divergence,
  c'est lui qui fait autorité.
- Le réveil **n'exige aucune authentification** : ni appairage, ni compte Philips.
- La **remise à l'heure du réveil** appartient au collecteur, qui tourne en continu ;
  l'application signale un écart, elle ne le corrige pas.

## Contenu du dépôt

| Chemin | Contenu |
| --- | --- |
| `.claude/specs/` | Cadrages fonctionnels datés — périmètre, cas limites, décisions et leurs raisons |
| `design/*.dc.html` | Maquettes : prototype navigable et états dégradés, sources du canvas |
| `docs/seuils-conditions-sommeil.md` | Seuils de qualité du sommeil relevés dans SleepMapper avant la coupure |
| `docs/sleepmapper/README.md` | Relevé écrit de l'interface remplacée, écran par écran |
| `AGENTS.md` | Conventions du dépôt, à l'usage des contributeurs et des agents |

Le périmètre fonctionnel de l'application — ce qu'elle fait, ce qu'elle ne fait pas, et
pourquoi — est décrit dans le cadrage :
[`.claude/specs/2026-09-05-spec-fonctionnelle-sleepmaxxer.md`](.claude/specs/2026-09-05-spec-fonctionnelle-sleepmaxxer.md).

Protocole du réveil, sémantique des champs et pièges matériels : `docs/somneo-api.md` **du
dépôt Somneo-Scraper**.

> Les captures d'écran de `docs/sleepmapper/` ne sont pas versionnées (données personnelles) :
> sur un clone frais, seul le relevé écrit existe.

## Licence

GPL-3.0.
