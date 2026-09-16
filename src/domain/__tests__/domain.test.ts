import type { Night } from '../../data/types';
import { alarmEdit, daysLabel, formFromProfile, powerwakeDelta } from '../alarms';
import { backupReminderDue, buildBackup, parseBackup, type BackupContent } from '../backup';
import { lightThemes, soundName, wakeSounds } from '../catalog';
import { durationLong, durationShort, formatMeasure, formatNumber, nightLabel } from '../format';
import { currentNight, inBedSeconds, nightPhase, observedTime, timeOrigin } from '../nights';
import { findGaps, gapCause, summarize } from '../stats';
import { coachSummary } from '../summary';
import { bandFor, METRICS, verdict } from '../thresholds';
import { averageInBed, monthOf, nightBar, weekOf } from '../views';

/** Instant local (Europe/Paris, fixé dans le script de test). */
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime() / 1000;

const night = (over: Partial<Night> = {}): Night => ({
  id: 1, seq: 1, day: '2026-09-13', bedtime: at(2026, 9, 13, 23, 29), risetime: at(2026, 9, 14, 6, 51),
  state: 'closed', bedtime_origin: 'observed', risetime_origin: 'estimated', raw_tg2bd: null, raw_tendb: null,
  ...over,
});

describe('seuils et verdicts', () => {
  it('juge la température autour de la plage idéale, bornes comprises en bas', () => {
    expect(verdict('temp', 17).tone).toBe('ideal');
    expect(verdict('temp', 18.9).tone).toBe('ideal');
    expect(verdict('temp', 19).text).toBe('Chaud — au-dessus de la plage idéale');
    expect(verdict('temp', 25.8).text).toBe('Trop chaud — au-dessus de la plage idéale');
    expect(verdict('temp', 13.9).text).toBe('Trop froid — en dessous de la plage idéale');
    expect(verdict('hum', 35).text).toBe('Sec — en dessous de la plage idéale');
  });

  it('compare la lumière et le bruit, sans jamais les juger', () => {
    expect(verdict('snd', 34)).toMatchObject({ tone: 'reference', text: 'Équivalent : bibliothèque municipale' });
    expect(verdict('lux', 2799).text).toBe('Équivalent : centre commercial');
    expect(verdict('lux', 3).tone).toBe('ideal');
  });

  it('a des bandes contiguës, sans trou ni recouvrement', () => {
    for (const info of Object.values(METRICS)) {
      for (let i = 1; i < info.bands.length; i += 1) expect(info.bands[i].to).toBe(info.bands[i - 1].from);
      expect(info.bands.filter((b) => b.ideal)).toHaveLength(1);
    }
  });

  it('range une valeur aberrante sans la corriger', () => {
    expect(bandFor('lux', -3).ideal).toBe(true);
    expect(bandFor('snd', 500).label).toBe('Marteau-piqueur');
  });
});

describe('mise en forme', () => {
  it('écrit les nombres à la française, avec la précision du capteur', () => {
    expect(formatNumber(21.44, 1)).toBe('21,4');
    expect(formatNumber(10000, 0)).toBe('10\u202f000');
    expect(formatMeasure('temp', 25.83)).toBe('25,8');
    expect(formatMeasure('hum', 52.22)).toBe('52');
    expect(formatMeasure('snd', null)).toBe('—');
  });

  it('écrit les durées', () => {
    expect(durationShort(26473)).toBe('7:21');
    expect(durationLong(7 * 3600 + 5 * 60)).toBe('7 h 05');
  });

  it('intitule une nuit par le jour de son coucher', () => {
    expect(nightLabel(night())).toBe('Nuit du 13 au 14 septembre');
    expect(nightLabel(night({ day: '2026-09-14', bedtime: at(2026, 9, 14, 0, 30) }))).toBe('Nuit du 14 septembre');
    expect(nightLabel(night({ day: '2026-09-30', bedtime: at(2026, 9, 30, 23, 0) }))).toBe('Nuit du 30 septembre au 1er octobre');
  });

  it('garde juste une nuit qui traverse le changement d’heure', () => {
    const n = night({ day: '2026-10-24', bedtime: at(2026, 10, 24, 23, 0), risetime: at(2026, 10, 25, 7, 0) });
    expect(inBedSeconds(n, 0)).toBe(9 * 3600); // 23 h → 7 h, avec une heure rendue à 3 h
  });
});

describe('nuits', () => {
  it('restitue l’origine de chaque heure', () => {
    const n = night();
    expect(timeOrigin(n, 'bedtime')).toBe('confirmé');
    expect(timeOrigin(n, 'risetime')).toBe('estimé');
    expect(timeOrigin(night({ risetime_origin: 'corrected' }), 'risetime')).toBe('corrigé');
    expect(timeOrigin(night({ risetime: null, state: 'abnormal' }), 'risetime')).toBeNull();
  });

  it('montre le relevé d’une heure corrigée, et rien sinon', () => {
    const corrigee = night({
      bedtime: at(2026, 9, 13, 23, 14), bedtime_origin: 'corrected',
      bedtime_observed: at(2026, 9, 13, 23, 41), bedtime_observed_origin: 'observed',
    });
    expect(observedTime(corrigee, 'bedtime')).toEqual({ value: at(2026, 9, 13, 23, 41), origin: 'confirmé' });
    expect(observedTime(corrigee, 'risetime')).toBeNull();
    // une nuit copiée avant le contrat du 2026-09-15 n'a pas de relevé à montrer
    expect(observedTime(night({ bedtime_origin: 'corrected' }), 'bedtime')).toBeNull();
  });

  it('ne présente jamais un appui retenu comme un suivi en cours', () => {
    expect(nightPhase(night({ state: 'pending_device', risetime: null }))).toBe('waiting-device');
    expect(nightPhase(night({ state: 'open', risetime: null }))).toBe('ongoing');
    expect(nightPhase(night({ state: 'closed', risetime: null }))).toBe('awaiting-rise');
    expect(nightPhase(night({ state: 'abnormal', risetime: null }))).toBe('abnormal');
  });

  it('trouve la nuit en cours, et seulement si elle l’est', () => {
    const done = night();
    const open = night({ id: 2, day: '2026-09-14', bedtime: at(2026, 9, 14, 23), risetime: null, state: 'open' });
    expect(currentNight([done])).toBeNull();
    expect(currentNight([done, open])?.id).toBe(2);
  });
});

describe('statistiques et trous', () => {
  const pts = [0, 60, 120, 900, 960].map((ts, i) => ({ ts: 1000 + ts, mstmp: 20 + i, msrhu: null, mslux: 0, mssnd: 30 }));

  it('porte sur ce qui a été mesuré', () => {
    expect(summarize(pts, 'temp')).toMatchObject({ min: 20, max: 24, avg: 22, count: 5 });
    expect(summarize(pts, 'hum')).toBeNull();
  });

  it('montre les trous, sans les combler', () => {
    const gaps = findGaps(pts.map((p) => p.ts), 0, 5000);
    expect(gaps).toEqual([{ from: 0, to: 1000 }, { from: 1120, to: 1900 }, { from: 1960, to: 5000 }]);
  });

  it('nomme la cause fournie par le collecteur, et dit quand elle manque', () => {
    const gap = { from: 1120, to: 1900 };
    expect(gapCause(gap, [{ start: 1100, end: 1950, cause: 'carte hors réseau' }], 9999)).toBe('carte hors réseau');
    expect(gapCause(gap, [], 9999)).toBe('cause non fournie par le collecteur');
  });
});

describe('résumé pour le coach', () => {
  const stats = { temp: { min: 25.5, avg: 25.83, max: 26.1, count: 429, first: at(2026, 9, 13, 23, 30), last: at(2026, 9, 14, 6, 51) } };

  it('produit le texte d’une nuit complète', () => {
    const r = coachSummary({ night: night(), bedtimeOrigin: 'confirmé', risetimeOrigin: 'estimé', stats });
    expect(r.ok && r.text).toContain('- Nuit du 13 au 14 septembre 2026');
    expect(r.ok && r.text).toContain('- Levé : 06:51 (estimé)');
    expect(r.ok && r.text).toContain('- Temperature'.replace('Temperature', 'Température') + ' : 25,5 / 25,8 / 26,1 °C');
    expect(r.ok && r.text).toContain('- Bruit : pas de données');
  });

  it('dit ce qui manque plutôt que de l’omettre', () => {
    const r = coachSummary({ night: night({ risetime: null, state: 'abnormal' }), bedtimeOrigin: 'confirmé', risetimeOrigin: null, stats: {} });
    expect(r.ok && r.text).toContain('la nuit est restée ouverte');
    expect(r.ok && r.text).toContain('Aucun relevé de conditions pour cette nuit.');
  });

  it('refuse une nuit en cours, avec la raison', () => {
    const r = coachSummary({ night: night({ risetime: null, state: 'open' }), bedtimeOrigin: 'confirmé', risetimeOrigin: null, stats });
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("n'est pas terminée") });
  });
});

describe('alarmes', () => {
  const profile = {
    prfnr: 1, prfen: true, prfvs: true, almhr: 6, almmn: 50, daynm: 62, curve: 20, durat: 30, ctype: 0,
    snddv: 'wus', sndch: '1', sndlv: 12, pwrsz: 1, pszhr: 7, pszmn: 0,
  };

  it('déduit le libellé des jours cochés', () => {
    expect(daysLabel(62)).toBe('Jours de la semaine');
    expect(daysLabel(254)).toBe('Tous les jours');
    expect(daysLabel(2 | 8)).toBe('Lun Mer');
    expect(daysLabel(0)).toBe('Une seule fois');
  });

  it('calcule le délai du PowerWake, minuit compris', () => {
    expect(powerwakeDelta(profile)).toBe(10);
    expect(powerwakeDelta({ ...profile, almhr: 23, almmn: 55, pszhr: 0, pszmn: 5 })).toBe(10);
    expect(powerwakeDelta({ ...profile, pwrsz: 0 })).toBeNull();
  });

  it("n'envoie que ce qui a changé, et le PowerWake quand l'heure bouge", () => {
    const before = formFromProfile(profile);
    expect(alarmEdit(before, { ...before, sndlv: 14 })).toEqual({ sndlv: 14 });
    expect(alarmEdit(before, { ...before, hour: 7 })).toEqual({ hour: 7, powerwake: { on: true, delta: 10 } });
    expect(alarmEdit(before, { ...before, powerwakeOn: false })).toEqual({ powerwake: { on: false } });
    expect(alarmEdit(before, before)).toEqual({});
  });
});

describe('catalogue', () => {
  it('numérote les thèmes par rang et les sons par clé, comme pysomneo', () => {
    const catalog = { served_at: 0, catalog: { lightthemes: { source: 'appareil', themes: { '1': { name: 'Sunny day' }, '2': { name: 'Island red' } } } } };
    expect(lightThemes(catalog, 'lightthemes').map((t) => [t.ctype, t.name])).toEqual([[0, 'Sunny day'], [1, 'Island red']]);
    expect(wakeSounds(null)[0]).toEqual({ snddv: 'wus', sndch: '1', name: 'Forest Birds' });
    expect(soundName(wakeSounds(null), 'off', '')).toBe('Aucun son');
  });
});

describe('vues agrégées', () => {
  it('découpe la semaine du lundi au dimanche, et le mois', () => {
    expect(weekOf('2026-09-16')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    expect(monthOf('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('place la plage de sommeil sur l’axe midi → midi', () => {
    const bar = nightBar(night(), 0, true);
    expect(bar?.startMin).toBeCloseTo(11 * 60 + 29, 0);
    expect(bar?.endMin).toBeCloseTo(18 * 60 + 51, 0);
    expect(averageInBed([night(), night({ id: 2, bedtime: null })])).toBe((at(2026, 9, 14, 6, 51) - at(2026, 9, 13, 23, 29)));
  });
});

describe('sauvegarde', () => {
  const content: BackupContent = {
    nights: [night()],
    readings: [{ seq: 1, ts: 10, mslux: 0, mstmp: 20.5, msrhu: 50, mssnd: 30, avlux: null, avtmp: null, avrhu: null, avsnd: null }],
    aggregates: [{ seq: 2, ts: 11, kind: 'temp', avg: 1, lo: 0, hi: 2, hist: null }],
    outages: [{ id: 1, seq: 3, start: 5, end: null, cause: 'réveil injoignable', failures: 2 }],
    corrections: [{ id: 1, seq: 4, night_id: 1, ts: 12, field: 'bedtime', value: null }],
    cursor: { highSeq: 3, liveSeq: 3, backfillSeq: 3, recentBefore: null, suspended: null },
    settings: null,
    snapshot: null,
  };

  it('se relit à l’identique', () => {
    const parsed = parseBackup(buildBackup(content, 100, '1.0.0'));
    expect(parsed).toEqual({ ok: true, exportedAt: 100, content });
  });

  it('refuse net un fichier invalide, sans import partiel', () => {
    const text = buildBackup(content, 100, '1.0.0');
    expect(parseBackup(text.slice(0, text.length / 2)).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: 'autre' })).ok).toBe(false);
    expect(parseBackup(text.replace('"version":2', '"version":3')).ok).toBe(false);
    expect(parseBackup(text.replace('20.5', '"vingt"')).ok).toBe(false);
  });

  it('relit une sauvegarde de version 1, sans journal ni instantané', () => {
    const v1 = JSON.stringify({
      ...JSON.parse(buildBackup(content, 100, '1.0.0')),
      version: 1, corrections: undefined, snapshot: undefined,
    });
    const parsed = parseBackup(v1);
    expect(parsed.ok && parsed.content.corrections).toEqual([]);
    expect(parsed.ok && parsed.content.snapshot).toBeNull();
  });

  it('rappelle la sauvegarde au palier, et pas avant', () => {
    const d = 86400;
    expect(backupReminderDue(10 * d, null, 0, null)).toBe(true);
    expect(backupReminderDue(10 * d, 5 * d, 0, null)).toBe(false);
    expect(backupReminderDue(10 * d, null, 0, 12 * d)).toBe(false);
    expect(backupReminderDue(10 * d, null, null, null)).toBe(false);
  });
});
