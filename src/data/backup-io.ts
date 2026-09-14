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
import { getMetaJson, readEverything, replaceEverything, setMetaJson, sqliteSyncStore } from './db';
import type { DeviceMirror } from './types';

const DEVICE_KEY = 'device.last';

export async function writeExportFile(): Promise<{ uri: string; bytes: number }> {
  const [everything, cursor, settings] = await Promise.all([
    readEverything(),
    sqliteSyncStore.getCursor(),
    getMetaJson<DeviceMirror>(DEVICE_KEY),
  ]);
  const content: BackupContent = { ...everything, cursor, settings };
  const text = buildBackup(content, Date.now() / 1000, Constants.expoConfig?.version ?? '0');
  const file = new File(Paths.cache, `sleepmaxxer-${isoDay(new Date())}.json`);
  try {
    file.delete();
  } catch {
    // pas de fichier précédent
  }
  file.create();
  file.write(text);
  return { uri: file.uri, bytes: text.length };
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
