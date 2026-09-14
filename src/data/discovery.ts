/**
 * Trouver le collecteur sur le réseau domestique, par mDNS. Aucune adresse en dur, ni dans un
 * sens ni dans l'autre (cadrage §5, 2026-09-12). Le nom du service est un contrat avec le
 * collecteur (plan technique §2) : `_somneo-scraper._tcp`, enregistrement TXT `api=v1`.
 */
import * as ServiceDiscovery from '@inthepocket/react-native-service-discovery';

export const SERVICE_TYPE = 'somneo-scraper';
export const API_VERSION = 'v1';

export function baseUrlOf(address: string, port: number): string {
  return address.includes(':') ? `http://[${address}]:${port}` : `http://${address}:${port}`;
}

/** L'adresse du premier collecteur annoncé, ou `null` au bout du délai. */
export function discoverCollector(timeoutMs = 6000): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: { remove: () => void } | null = null;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.remove();
      ServiceDiscovery.stopSearch(SERVICE_TYPE).catch(() => undefined);
      resolve(url);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    subscription = ServiceDiscovery.addEventListener('serviceFound', (service) => {
      if (!service.type.startsWith(`_${SERVICE_TYPE}.`)) return;
      if (service.txt?.api && service.txt.api !== API_VERSION) return;
      const ipv4 = service.addresses.find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
      const address = ipv4 ?? service.addresses[0];
      if (address) finish(baseUrlOf(address, service.port));
    });
    ServiceDiscovery.startSearch(SERVICE_TYPE).catch(() => finish(null));
  });
}
