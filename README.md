# SleepMaxxer

Application Android qui remplace **SleepMapper**, l'application constructeur du réveil
**Philips Somneo HF3671/01**, pour permettre de couper l'accès internet de l'appareil sans
rien perdre de ce qui sert au quotidien.

Front-end du projet. Le back-end est
[Somneo-Scraper](https://github.com/VictorLabeille/Somneo-Scraper), qui collecte, historise et
relaie.

Stack : **Expo SDK 56** · React Native · TypeScript · SQLite.

> **État : application écrite le 2026-09-14, testée contre le collecteur déployé ; en essai.**
> Les choix faits sans arbitrage sont listés, avec leur raison, dans
> [`.claude/specs/2026-09-14-plan-technique-app.md`](.claude/specs/2026-09-14-plan-technique-app.md).
> Reste à vérifier sur le téléphone : la découverte du collecteur par mDNS, et le geste du
> coucher, d'une main, dans le noir.

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
- **L'heure du réveil ne se remet pas à l'heure** : aucune voie d'écriture n'existe (mesuré le
  2026-09-13, dépôt Somneo-Scraper). Le collecteur mesure l'écart, l'application le signale.
  Les heures des nuits, elles, viennent du collecteur (NTP), et restent justes.

## Contenu du dépôt

| Chemin | Contenu |
| --- | --- |
| `src/` | L'application : écrans, règles du domaine, copie locale, rattrapage, découverte du collecteur |
| `app.json`, `eas.json` | Configuration Expo et profils de construction |
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

## Développer

```bash
npm install
npm test               # règles du domaine, et rattrapage contre un faux collecteur
npm run typecheck
COLLECTOR_URL=http://<carte>:8760 npm test -- collector.live   # contrat, vrai collecteur, lecture seule
```

**Sur le téléphone**, l'app trouve le collecteur seule, par mDNS : aucune adresse à saisir.

**Dans l'émulateur**, le multicast ne traverse pas son NAT : l'adresse se donne à Metro, pour le
développement seulement.

```bash
EXPO_PUBLIC_COLLECTOR_URL=http://<carte>:8760 npx expo start
```

**Construire l'APK** : `eas build -p android --profile preview`, ou sans EAS, avec un JDK 17 et le
SDK Android (`JAVA_HOME`, `ANDROID_HOME`) :

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# → android/app/build/outputs/apk/release/app-release.apk, pour un téléphone arm64
```

`android/` est généré et non versionné : toute configuration native passe par `app.json`. L'APK
local est signé avec la clé de débogage — suffisant pour l'installer sur son propre téléphone.

## Licence

GPL-3.0.
