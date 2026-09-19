# SleepMaxxer

**The app that lets a connected alarm clock be disconnected.**

An Android replacement for SleepMapper, the vendor app of the Philips Somneo HF3671/01. It shows
the sleep history, drives the light and the alarms, and never needs the manufacturer's servers —
or an account, or a pairing step.

Front end of the project. The back end is
[Somneo-Scraper](https://github.com/VictorLabeille/Somneo-Scraper), which collects, stores and
relays.

**Expo SDK 56 · React Native · TypeScript · SQLite**

## Why it has to exist

Comfort is the obvious reason — SleepMapper is slow to start and carries features nobody asked
for. It is not the real one.

Reverse engineering the device established that **its local API has no memory**. It answers with
the present moment, the 15-minute aggregation window in progress, and the night in progress.
SleepMapper's history charts come from the Philips cloud, which the clock feeds itself.

**So cutting the internet removes the vendor app's main function.** Isolating the clock is only
possible if you already own its history and its remote control. SleepMaxxer is not a nicer front
end; it is the condition that makes isolation survivable.

One more finding, from the same work: the clock applies **no access control on the local network**.
The port that hands out its security key and the port that triggers a factory reset will answer
anyone on the LAN.

## How the pieces fit

```
Somneo HF3671/01  ←→  Somneo-Scraper (Radxa Zero, 24/7)  ←→  SleepMaxxer
   local API             collects · stores · relays          (this repo)
   no memory             SQLite — the source                 local copy
                                                             + Drive export
```

- The app **never talks to the clock directly** — history, live values and control all go through
  the collector.
- Collector and phone sit on the **same home network**. Nothing is exposed outside it.
- The phone keeps a **full copy of the history**, caught up on every launch. It is the backup — the
  collector is otherwise the sole holder of data that cannot be measured again — and it makes the
  history readable away from home, read-only, without the collector ever leaving the network. On a
  disagreement, the collector wins.
- **The clock's time cannot be set**: no write path exists. The collector measures the drift and
  the app reports it. Night timestamps come from the collector, on NTP, and stay correct.

## Repository map

| Path | What is there |
| --- | --- |
| `src/` | The app: screens, domain rules, local copy, catch-up, collector discovery |
| `app.json`, `eas.json` | Expo configuration and build profiles |
| `.claude/specs/` | Dated functional specs — scope, edge cases, decisions and their reasons |
| `design/*.dc.html` | Mockups: navigable prototype and degraded states |
| `docs/` | Sleep-quality thresholds read from SleepMapper, and a written record of the replaced interface, screen by screen |
| `AGENTS.md` | Conventions, scope and hard rules for anyone — human or agent — working on this repo |

The device protocol, field semantics and hardware traps live in `docs/somneo-api.md` **of the
Somneo-Scraper repository**.

> The SleepMapper screenshots under `docs/sleepmapper/` are not versioned — they hold personal
> data. On a fresh clone only the written record exists.

Documentation is in French; this page is not.

## Developing

```bash
npm install
npm test               # domain rules, and catch-up against a fake collector
npm run typecheck
COLLECTOR_URL=http://<board>:8760 npm test -- collector.live   # contract, real collector, read-only
```

**On a phone**, the app finds the collector by itself over mDNS — no address to type.

**In the emulator**, multicast does not cross its NAT, so the address is handed to Metro, for
development only:

```bash
EXPO_PUBLIC_COLLECTOR_URL=http://<board>:8760 npx expo start
```

**Building the APK**: `eas build -p android --profile preview`, or locally with a JDK 17 and the
Android SDK (`JAVA_HOME`, `ANDROID_HOME`):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# → android/app/build/outputs/apk/release/app-release.apk, for an arm64 phone
```

`android/` is generated and not versioned: native configuration goes through `app.json`. A local
APK is signed with the debug key — enough to install on your own phone.

## Licence

GPL-3.0.
