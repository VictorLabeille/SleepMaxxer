import type { Night } from '../../data/types';
import { resolveCorrection } from '../nights';

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime() / 1000;

const night = (over: Partial<Night> = {}): Night => ({
  id: 1, seq: 1, day: '2026-09-13', bedtime: at(2026, 9, 13, 23, 29), risetime: at(2026, 9, 14, 6, 51),
  state: 'closed', bedtime_origin: 'confirmed', risetime_origin: 'confirmed', raw_tg2bd: null, raw_tendb: null,
  ...over,
});

describe('heure choisie à la roue', () => {
  it('garde le coucher le même soir, et le lever le lendemain matin', () => {
    expect(resolveCorrection(night(), 'bedtime', 23, 10)).toBe(at(2026, 9, 13, 23, 10));
    expect(resolveCorrection(night(), 'risetime', 7, 30)).toBe(at(2026, 9, 14, 7, 30));
  });

  it('suit une nuit à cheval sur minuit dans les deux sens', () => {
    expect(resolveCorrection(night(), 'bedtime', 0, 20)).toBe(at(2026, 9, 14, 0, 20));
    const late = night({ day: '2026-09-14', bedtime: at(2026, 9, 14, 0, 30) });
    expect(resolveCorrection(late, 'bedtime', 23, 50)).toBe(at(2026, 9, 13, 23, 50));
  });

  it('place un lever absent après le coucher', () => {
    const open = night({ risetime: null, state: 'abnormal' });
    expect(resolveCorrection(open, 'risetime', 6, 45)).toBe(at(2026, 9, 14, 6, 45));
  });
});
