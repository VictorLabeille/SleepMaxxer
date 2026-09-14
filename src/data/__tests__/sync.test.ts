/** @jest-environment node */
import { ITEMS_PAGE, RECENT_PAGE_NIGHTS, runSync } from '../sync';
import { FakeCollector, MemoryStore } from '../testing/fake-collector';

const HOUR = 3600;
const DAY = 86400;
const T0 = Date.UTC(2026, 8, 1, 20, 0, 0) / 1000;

/** Vingt nuits, une mesure par minute jour et nuit, un agrégat par nuit, un trou nommé. */
function populated(): FakeCollector {
  const c = new FakeCollector();
  for (let d = 0; d < 20; d += 1) {
    for (let m = 0; m < 24 * 60; m += 5) c.addReading(T0 + d * DAY + m * 60);
    const bed = T0 + d * DAY + 3 * HOUR;
    c.addNight(d + 1, `2026-09-${String(d + 1).padStart(2, '0')}`, bed, bed + 7 * HOUR);
    c.addAggregate(bed + HOUR, 'temp');
  }
  c.addAggregate(T0 + 12 * HOUR, 'hum'); // hors de toute nuit
  c.addOutage(1, T0 + 5 * DAY, T0 + 5 * DAY + HOUR, 'carte hors réseau');
  return c;
}

const now = () => T0 + 30 * DAY;

describe('rattrapage de la copie locale', () => {
  it('copie tout, y compris ce que le mode « récentes d’abord » ne porte pas', async () => {
    const c = populated();
    const store = new MemoryStore();
    await expect(runSync(c.api(), store, { now })).resolves.toEqual({ kind: 'done' });
    expect(store.nights.size).toBe(20);
    expect(store.readings.size).toBe(c.readings.length); // points de jour compris
    expect(store.outages.size).toBe(1);
    expect(store.aggregates.size).toBe(c.aggregates.length);
  });

  it('commence par les nuits les plus récentes', async () => {
    const c = populated();
    const store = new MemoryStore();
    await runSync(c.api(), store, { now });
    const firstIds = store.applied[0].nights.map((n) => n.id).sort((a, b) => a - b);
    expect(firstIds).toEqual([14, 15, 16, 17, 18, 19, 20]);
    expect(firstIds).toHaveLength(RECENT_PAGE_NIGHTS);
  });

  it('reprend là où il s’était arrêté, jamais depuis le début', async () => {
    const c = populated();
    expect(c.readings.length).toBeGreaterThan(2 * ITEMS_PAGE);
    const store = new MemoryStore();
    store.failOnApply = 5; // en plein rattrapage de fond
    await expect(runSync(c.api(), store, { now })).rejects.toThrow('interrompu');
    const saved = store.cursor.backfillSeq ?? 0;
    expect(saved).toBeGreaterThan(0);

    c.calls = [];
    await runSync(c.api(), store, { now });
    expect(c.calls).not.toContain('since:0');
    expect(c.calls).toContain(`since:${saved}`);
    expect(store.readings.size).toBe(c.readings.length);
  });

  it('ramène une nuit corrigée après copie, avec la valeur du collecteur', async () => {
    const c = populated();
    const store = new MemoryStore();
    await runSync(c.api(), store, { now });
    const corrected = (c.nights[2].bedtime ?? 0) - 600;
    c.correct(3, 'bedtime', corrected);
    await runSync(c.api(), store, { now });
    expect(store.nights.get(3)?.bedtime).toBe(corrected);
  });

  it('ne perd rien quand le collecteur en sait moins que le téléphone', async () => {
    const c = populated();
    const store = new MemoryStore();
    await runSync(c.api(), store, { now });
    c.wipe();
    c.addReading(now());
    const outcome = await runSync(c.api(), store, { now });
    expect(outcome.kind).toBe('suspended');
    expect(store.nights.size).toBe(20);
    expect(store.cursor.suspended).not.toBeNull();
    // et reste suspendu ensuite, sans rien demander au collecteur
    c.calls = [];
    await runSync(c.api(), store, { now });
    expect(c.calls).toEqual([]);
  });

  it('garde le type d’un agrégat que le rattrapage par séquence efface', async () => {
    const c = populated();
    const store = new MemoryStore();
    await runSync(c.api(), store, { now });
    const inNight = c.aggregates.find((a) => a.kind === 'temp' && a.ts > T0 + 19 * DAY);
    const outside = c.aggregates.find((a) => a.kind === 'hum');
    expect(store.aggregates.get(inNight?.seq ?? -1)?.kind).toBe('temp');
    // arrivé seulement par `since_seq` : type perdu côté collecteur, pas deviné ici
    expect(store.aggregates.get(outside?.seq ?? -1)?.kind).toBeNull();
  });
});
