# Plan technique — l'application SleepMaxxer

> Statut : **écrit et appliqué** le 2026-09-14, dans la même session que le code · Répond au
> cadrage du 2026-09-05 (`2026-09-05-spec-fonctionnelle-sleepmaxxer.md`), contre le collecteur
> déployé (Somneo-Scraper à `4019c88`).

Ce document diffère du plan du collecteur sur un point, et il faut le dire d'emblée : **il n'a pas
été arbitré point par point.** Victor a demandé que l'application fonctionne, sans avoir le temps de
trancher les questions ouvertes. Chaque choix qu'il aurait normalement arbitré est donc marqué
**« défaut »**, avec sa raison, pour pouvoir être revu sans avoir à le retrouver dans le code. Un
défaut renversé plus tard se consigne en §6 comme un renversement, pas en réécrivant ce qui suit.

Les écarts entre le collecteur et le contrat, que l'app contourne, sont décrits côté backend :
`.claude/specs/2026-09-14-ecarts-contrat-sleepmaxxer.md` **du dépôt Somneo-Scraper**.

---

## 1. Pile

| Choix | Pourquoi |
| --- | --- |
| Expo SDK 56, React Native 0.85, TypeScript | La version de Commit & Push, dont la chaîne de construction (EAS, profil `preview` en APK) est éprouvée. La 57 existait ; rien ne la réclamait. |
| `expo-router`, deux onglets et une pile | Parité avec la navigation de SleepMapper (cadrage §2). |
| `zustand` pour l'état vivant | Comme Commit & Push. L'historique, lui, est dans SQLite. |
| `expo-sqlite` pour la copie locale | Une copie complète et indéfinie (cadrage §2.C) : une base, pas un stockage clé-valeur. |
| `@inthepocket/react-native-service-discovery` pour le mDNS | Module natif en nouvelle architecture (TurboModule), maintenu (juillet 2026), `NsdManager` sous Android. `react-native-zeroconf` était l'autre candidat, plus ancien. |
| `expo-network` | Savoir si l'on est en Wi-Fi, **sans permission de localisation** (voir défaut 3). |
| `react-native-svg`, `@react-native-community/slider` | Courbes et barres dessinées à la main ; curseurs natifs. |
| `expo-build-properties` → `usesCleartextTraffic` | Le collecteur sert du HTTP en clair sur le réseau domestique ; Android le refuse sinon. |
| `expo-file-system`, `expo-sharing`, `expo-document-picker`, `expo-clipboard` | Export vers le Drive par la feuille de partage, restauration depuis un fichier, résumé pour le coach. |

Pas de flou (`backdrop-filter`) sur les cartes : sur un fond de nuit uni il n'a rien à flouter. Le
« verre discret » retenu par la direction artistique n'est qu'un aplat translucide.

## 2. Structure

```
src/app/      routes (expo-router) : (tabs)/index, (tabs)/sleep, alarms/, sunset, detail, calendar, backup
src/domain/   règles pures, testées : seuils et verdicts, formats, nuits, statistiques et trous,
              résumé coach, alarmes, catalogue, vues agrégées, format de sauvegarde
src/data/     client de l'API, copie locale (SQLite), rattrapage, découverte mDNS, sauvegarde
src/state/    état vivant, chef d'orchestre (connexion, sondage, rattrapage), commandes, liaison
src/ui/       thème, pièces communes, feuilles et roue d'heure, graphiques, vues d'une nuit
```

## 3. Fonctionnement

- **Trouver le collecteur** : l'adresse retenue d'abord (une requête), puis mDNS
  (`_somneo-scraper._tcp`, TXT `api=v1`). `EXPO_PUBLIC_COLLECTOR_URL` court-circuite la découverte
  pour le développement (émulateur, dont le NAT ne laisse pas passer le multicast) ; il n'existe pas
  dans une version livrée, et aucune adresse n'est écrite dans le dépôt.
- **Rester à jour sans geste** : état et miroir de l'appareil toutes les 15 s au premier plan,
  rattrapage toutes les 5 min, nouvelle recherche toutes les 30 s quand le collecteur manque, et
  aussitôt au retour au premier plan ou au changement de réseau. Pas de tâche de fond.
- **Écrire sans mentir** : toute commande passe par une file, une à la fois. L'écran ne montre que
  l'état relu par le relais ; un `502` (écriture non reflétée) ramène l'affichage à l'état relu.
- **Rattraper la copie** : trois passes reprenables — les nuits récentes d'abord, puis le fil de
  l'eau par séquence, puis tout le reste depuis `since_seq=0` (le mode `before` ne porte pas les
  points hors nuit ni les trous). Chaque page s'enregistre avec son curseur, d'un bloc.

## 4. Défauts pris sans arbitrage

1. **Départ en douceur : non affiché.** Le cadrage §2.A le range parmi les réglages d'alarme ; le
   collecteur a mesuré que `sndss` s'écrit mais que son effet est inconnu, et demande de ne pas le
   montrer. Un interrupteur dont on ne sait pas ce qu'il commande serait un mensonge d'interface.
2. **« Test sur l'appareil » (écran Soleil de la maquette) : retiré.** Absent du cadrage, et aucune
   route du collecteur ne le porte.
3. **Hors du domicile ou collecteur muet** : sans permission de localisation, l'app ne connaît pas
   le nom du Wi-Fi. Hors Wi-Fi → « hors du réseau domestique », lecture seule, sans ambre. En Wi-Fi
   sans collecteur → « le collecteur ne répond pas », dont le texte évoque aussi un autre Wi-Fi que
   celui de la maison. La panne de réveil reste un message à part (cadrage §3.A).
4. **Écarts du collecteur : contournés côté app**, listés dans la spec du backend. Notamment : une
   nuit corrigée ailleurs qu'ici ne porte pas « corrigé » ; un trou sans indisponibilité s'affiche
   « cause non fournie par le collecteur », jamais « collecteur arrêté » par déduction.
5. **`bedtime_origin: observed`** (geste fait dans SleepMapper) **→ « confirmé »** : c'est un geste.
6. **Rappel de sauvegarde : 7 jours**, compté depuis le dernier export confirmé (ou la première
   copie) ; « Plus tard » le repousse d'un palier. **Résumé coach : figé**, au contenu proposé en
   §6 du cadrage, ouvert par la phrase de la maquette. **Profondeur navigable : tout l'historique.**
7. **Maquettes non mises à jour.** L'état « en attente du réveil » est dans le code, pas dans
   `design/`. Les bornes suivent le contrat, pas la maquette : PowerWake 1–59 min, volume 1–25,
   lampe 1–25.
8. **Thème « No light » : non proposé** — son encodage `ctype` n'est pas établi. **Radio FM :
   pas choisissable** (hors périmètre), seulement affichée si elle est déjà réglée.
9. **Vue Mois : une barre par nuit**, là où la maquette en dessinait une par semaine : c'est la
   régularité nuit par nuit que la vue doit montrer.
10. **Nuit couchée après minuit** : « Nuit du 14 septembre » (jour du coucher, cadrage §3.B), plutôt
    que « du 13 au 14 », qui annoncerait un soir qui n'est pas le sien.
11. **Export : la fin du partage se confirme à la main.** La feuille de partage d'Android ne dit pas
    si le fichier est parti ; un export annulé ne doit pas remettre le rappel à zéro (§3.E).
12. **Collecteur réinstallé** (sa séquence recule) : **rattrapage suspendu**, rien supprimé, écart
    signalé. Pas de reprise automatique : sans identité du collecteur, fusionner deux bases
    numérotées indépendamment n'est pas sûr.
13. **Gestes de nuit possibles quand seul le réveil manque** — le collecteur retient l'appui. Ils ne
    sont désactivés que si le collecteur lui-même ne répond pas.
14. **Correction d'heure possible dès que le collecteur répond**, réveil injoignable compris ; le
    lever d'une nuit en cours ne se corrige pas.
15. **Nuit close sans lever (expiration à 12 h)** : ses conditions ne sont pas calculées — sa fin
    n'est pas connue, et la supposer serait inventer une borne.
16. **Verdict des conditions : sur la moyenne de la nuit** ; pour une nuit en cours, sur le dernier
    relevé (« Maintenant »). Les agrégats de fenêtre sont copiés, pas affichés.
17. **Titres des courbes sans « moyenne »** (« Température (°C) ») : les points du collecteur sont
    des mesures instantanées, pas les moyennes au quart d'heure de Philips.
18. **Alarme masquée mais armée** : signalée sur l'accueil, avec un bouton pour la désactiver.

## 5. Vérification

- **Tests hors appareil** (`npm test`) : règles du domaine, liaison, format de sauvegarde, et le
  rattrapage contre un faux collecteur qui reproduit le vrai, écarts compris — première copie,
  reprise après interruption, nuit corrigée après copie, collecteur réinstallé, type d'agrégat.
- **Contrat vérifié contre le vrai collecteur**, en lecture seule :
  `COLLECTOR_URL=http://<carte>:8760 npm test -- collector.live`.
- **Essai sur émulateur, le 2026-09-14 au soir** (build de débogage, adresse du collecteur donnée
  à Metro) : l'app s'ouvre, trouve le collecteur, rattrape la copie (1 nuit, 1 479 relevés) et
  affiche sans erreur tous les écrans — accueil, nuit et conditions, détail d'une mesure,
  calendrier, semaine, alarmes, coucher de soleil, copie locale, résumé pour le coach. Les valeurs
  recoupent le résumé que le collecteur calcule de son côté.
- **Aucune écriture essayée**, exprès : c'était le soir, le réveil est dans une chambre, et un
  « je me couche » d'essai aurait créé une vraie nuit. Le collecteur refusait de toute façon toute
  commande (écart 10 de sa spec). Gestes, lumière, alarmes, correction d'heure : à essayer en
  journée, l'écart 10 réglé.
- **Reste à vérifier sur le téléphone** : la découverte mDNS (impossible dans l'émulateur) et le
  geste du coucher, d'une main, dans le noir.

## 6. Renversements

Aucun à ce jour.
