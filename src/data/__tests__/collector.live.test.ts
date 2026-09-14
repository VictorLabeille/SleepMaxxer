/**
 * @jest-environment node
 *
 * Contrat vérifié contre le vrai collecteur, en **lecture seule** : aucune route qui écrive, ni
 * `GET /v1/alarms/{n}` (qui sélectionne un profil sur l'appareil). Ignoré sans
 * `COLLECTOR_URL=http://<carte>:8760` — le dépôt n'y connaît aucune adresse.
 */
import http from 'node:http';

import { createCollectorApi } from '../api';
import { pageFromItems, pageFromNights } from '../sync';

const url = process.env.COLLECTOR_URL;
const suite = url ? describe : describe.skip;

/** Le preset jest-expo remplace `fetch` par un simulacre : ce test-ci veut le vrai réseau. */
function nodeFetch(target: string): Promise<{ status: number; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    http
      .get(target, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: async () => body }));
      })
      .on('error', reject);
  });
}

suite('collecteur réel, lecture seule', () => {
  const api = createCollectorApi(url ?? 'http://invalide', nodeFetch as unknown as typeof fetch);

  it('sert un état qui distingue les deux pannes', async () => {
    const s = await api.status();
    expect(typeof s.reveil.joignable).toBe('boolean');
    expect(Array.isArray(s.indisponibilites_ouvertes)).toBe(true);
    expect(typeof s.horloge.au_dela_du_seuil).toBe('boolean');
  });

  it('sert le miroir de l’appareil', async () => {
    const d = await api.device();
    expect(Array.isArray(d.alarms)).toBe(true);
    const light = d.ports.wulgt?.body;
    if (light) expect(typeof light.onoff).toBe('boolean');
    const root = d.ports.wualm?.body;
    if (root) expect(typeof root.snztm).toBe('number');
  });

  it('sert le catalogue des thèmes et des sons', async () => {
    const c = await api.catalog();
    expect(Object.keys(c.catalog)).toEqual(expect.arrayContaining(['wakeup', 'lightthemes']));
  });

  it('sert le rattrapage dans les deux modes', async () => {
    const since = await api.syncSince(0, 50);
    expect(since.current_seq).toBeGreaterThan(0);
    const page = pageFromItems(since.items);
    expect(page.readings.length + page.aggregates.length + page.nights.length + page.outages.length).toBe(since.count);
    const before = await api.syncBefore(Date.now() / 1000, 2);
    pageFromNights(before.nights).nights.forEach((n) => expect(typeof n.day).toBe('string'));
  });
});
