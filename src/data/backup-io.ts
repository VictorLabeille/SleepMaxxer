/**
 * Export vers le Drive (par la feuille de partage d'Android) et restauration depuis un fichier.
 * Le format et sa validation sont dans `domain/backup.ts`.
 */
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { buildBackup, parseBackup, type BackupContent, type ParsedBackup } from '../domain/backup';
import { isoDay } from '../domain/format';
import { getApi } from '../state/controller';
import { getMetaJson, readEverything, replaceEverything, setMetaJson, sqliteSyncStore } from './db';
import type { DeviceMirror, SettingsSnapshot } from './types';

const DEVICE_KEY = 'device.last';

/**
 * L'instantané des réglages vient du collecteur au moment de l'export, **à côté** de `settings`
 * (arbitrage §9.6). S'il manque — collecteur injoignable, ou antérieur au 2026-09-15 — l'export se
 * fait quand même : `settings` garde ce qu'il donnait déjà, et l'écran le dit.
 */
async function currentSnapshot(): Promise<SettingsSnapshot | null> {
  try {
    return (await getApi()?.settingsSnapshot()) ?? null;
  } catch {
    return null;
  }
}

export async function writeExportFile(): Promise<{ uri: string; bytes: number; snapshot: boolean }> {
  const [everything, cursor, settings, snapshot] = await Promise.all([
    readEverything(),
    sqliteSyncStore.getCursor(),
    getMetaJson<DeviceMirror>(DEVICE_KEY),
    currentSnapshot(),
  ]);
  const content: BackupContent = { ...everything, cursor, settings, snapshot };
  const text = buildBackup(content, Date.now() / 1000, Constants.expoConfig?.version ?? '0');
  const file = new File(Paths.cache, `sleepmaxxer-${isoDay(new Date())}.json`);
  try {
    file.delete();
  } catch {
    // pas de fichier précédent
  }
  file.create();
  file.write(text);
  return { uri: file.uri, bytes: text.length, snapshot: content.snapshot !== null };
}

/**
 * La feuille de partage ne dit pas si l'utilisateur est allé au bout : c'est à lui de le
 * confirmer ensuite, car un export annulé ne remet pas le rappel à zéro (cadrage §3.E).
 */
export async function shareExportFile(uri: string): Promise<void> {
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Sauvegarder la copie de SleepMaxxer',
  });
}

export async function pickBackupFile(): Promise<ParsedBackup | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.length) return null;
  const text = await new File(picked.assets[0].uri).text();
  return parseBackup(text);
}

export async function restoreBackup(content: BackupContent): Promise<void> {
  await replaceEverything(content);
  if (content.settings) await setMetaJson(DEVICE_KEY, content.settings);
}
