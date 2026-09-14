/**
 * Pas de mDNS dans un navigateur : la version web (aperçu de développement) ne se sert que de
 * `EXPO_PUBLIC_COLLECTOR_URL`.
 */
export const SERVICE_TYPE = 'somneo-scraper';

export function baseUrlOf(address: string, port: number): string {
  return address.includes(':') ? `http://[${address}]:${port}` : `http://${address}:${port}`;
}

export function discoverCollector(): Promise<string | null> {
  return Promise.resolve(null);
}
