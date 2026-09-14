import { deriveLink, type LinkInput } from '../link';

const base: LinkInput = {
  collector: 'ok', network: 'wifi', deviceReachable: true, deviceCause: null, hasCopy: true, copyLabel: 'copie du 14 sept. à 17:45',
};

describe('état de la liaison', () => {
  it('ne fond jamais les deux pannes en un seul message', () => {
    const muet = deriveLink({ ...base, collector: 'unreachable' });
    const reveil = deriveLink({ ...base, deviceReachable: false, deviceCause: 'réveil injoignable' });
    expect(muet.kind).toBe('collector-down');
    expect(reveil.kind).toBe('device-down');
    expect(muet.title).not.toBe(reveil.title);
    // dans le second cas l'historique reste entièrement lisible, et se met à jour
    expect(reveil.rows.history.ok && reveil.rows.sync.ok).toBe(true);
    expect(muet.rows.sync.ok).toBe(false);
  });

  it("réserve l'ambre à la seule vraie panne", () => {
    expect(deriveLink({ ...base, collector: 'unreachable' }).isFailure).toBe(true);
    expect(deriveLink({ ...base, collector: 'unreachable', network: 'other' }).isFailure).toBe(false);
    expect(deriveLink({ ...base, deviceReachable: false }).isFailure).toBe(false);
  });

  it('hors du domicile : lecture seule, raison affichée', () => {
    const v = deriveLink({ ...base, collector: 'unreachable', network: 'other' });
    expect(v.kind).toBe('away');
    expect(v.canControl || v.canCorrect).toBe(false);
    expect(v.controlReason).toMatch(/à la maison/);
  });

  it('la correction d’heure reste possible quand seul le réveil manque', () => {
    const v = deriveLink({ ...base, deviceReachable: false });
    expect(v.canControl).toBe(false);
    expect(v.canCorrect).toBe(true);
  });

  it("accueille la première utilisation plutôt que d'afficher une erreur", () => {
    expect(deriveLink({ ...base, collector: 'unreachable', hasCopy: false }).kind).toBe('first-run');
  });
});
