/**
 * La copie locale et sa sauvegarde. Le collecteur est la seule mémoire de l'historique, sur une
 * carte d'occasion : le téléphone en garde une copie complète, et le fichier exporté sert à
 * restaurer (cadrage §2.C).
 */
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { pickBackupFile, restoreBackup, shareExportFile, writeExportFile } from '../data/backup-io';
import { copyCounts, getMetaNumber, setMeta } from '../data/db';
import { estimateBackupBytes } from '../domain/backup';
import { ago, dateTimeShort, formatBytes, formatNumber } from '../domain/format';
import { reloadFromCopy, syncNow } from '../state/controller';
import { META_LAST_EXPORT, useAsync, useBackupReminder, useNow } from '../state/hooks';
import { useApp } from '../state/store';
import { Button, Card, Header, Notice, Row, Screen, Section, T } from '../ui/kit';
import { colors } from '../ui/theme';

const PHASE: Record<string, string> = {
  recent: 'nuits récentes',
  live: 'nouveautés',
  backfill: 'tout l’historique',
};

export default function BackupScreen() {
  const sync = useApp((s) => s.sync);
  const version = useApp((s) => s.dataVersion);
  const collector = useApp((s) => s.collector);
  const status = useApp((s) => s.status);
  const now = useNow();
  const [bump, setBump] = useState(0);
  const { data: counts } = useAsync(copyCounts, [version]);
  const { data: lastExport } = useAsync(() => getMetaNumber(META_LAST_EXPORT), [version, bump]);
  const reminder = useBackupReminder();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const doExport = async () => {
    setBusy('export');
    setMessage(null);
    try {
      const file = await writeExportFile();
      await shareExportFile(file.uri);
      Alert.alert(
        'La sauvegarde est-elle enregistrée ?',
        'Le téléphone ne sait pas si le partage est allé au bout. Un export annulé ne remet pas le rappel à zéro.',
        [
          { text: 'Non, annulé', style: 'cancel' },
          {
            text: 'Oui',
            onPress: async () => {
              await setMeta(META_LAST_EXPORT, String(Date.now() / 1000));
              setBump((b) => b + 1);
            },
          },
        ],
      );
    } catch (e) {
      setMessage({ tone: 'error', text: `L’export a échoué : ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const exportNow = () => {
    const estimate = counts ? estimateBackupBytes(counts) : 0;
    Alert.alert(
      'Exporter la copie',
      `Le fichier fera environ ${formatBytes(estimate)}. Il contient toutes les nuits, tous les relevés, et les derniers réglages connus du réveil. Choisissez ensuite Drive dans la feuille de partage.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Exporter', onPress: doExport },
      ],
    );
  };

  const restore = async () => {
    setMessage(null);
    setBusy('restore');
    let parsed;
    try {
      parsed = await pickBackupFile();
    } catch (e) {
      setMessage({ tone: 'error', text: `Le fichier n’a pas pu être lu : ${e instanceof Error ? e.message : String(e)}` });
      setBusy(null);
      return;
    }
    setBusy(null);
    if (!parsed) return;
    if (!parsed.ok) {
      setMessage({ tone: 'error', text: `${parsed.reason} La copie locale est intacte.` });
      return;
    }
    const content = parsed.content;
    Alert.alert(
      'Restaurer cette sauvegarde ?',
      `Sauvegarde du ${dateTimeShort(parsed.exportedAt)} : ${content.nights.length} nuits, ${formatNumber(content.readings.length, 0)} relevés. La copie de ce téléphone sera remplacée entièrement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Remplacer',
          style: 'destructive',
          onPress: async () => {
            setBusy('restore');
            try {
              await restoreBackup(content);
              await reloadFromCopy();
              setMessage({ tone: 'info', text: 'Copie restaurée.' });
              void syncNow();
            } catch (e) {
              setMessage({ tone: 'error', text: `La restauration a échoué, rien n’a été remplacé : ${e instanceof Error ? e.message : String(e)}` });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const syncState = sync.running
    ? `En cours — ${sync.phase ? PHASE[sync.phase] : ''}${sync.fraction !== null ? ` · ${Math.round(sync.fraction * 100)} %` : ''}`
    : sync.lastOkAt
      ? `À jour · ${ago(sync.lastOkAt, now)}`
      : 'Jamais fait';

  return (
    <Screen>
      <Header title="Copie locale" />
      <Card style={{ marginHorizontal: 16, marginBottom: 14, overflow: 'hidden' }}>
        <Row label="Nuits" value={counts ? formatNumber(counts.nights, 0) : '…'} />
        <Row label="Relevés" value={counts ? formatNumber(counts.readings, 0) : '…'} />
        <Row label="Rattrapage" value={syncState} />
        <Row label="Dernier export" value={lastExport ? dateTimeShort(lastExport) : 'Jamais'} last />
      </Card>
      {/* Troisième panne, distincte du collecteur muet et du réveil injoignable : l'heure de la
          carte. L'app la signale, elle ne corrige rien (cadrage §3.F, arbitrage §9.5). */}
      {status?.collecteur.heure_synchronisee === false ? (
        <Notice tone="warn" style={{ marginHorizontal: 16, marginBottom: 14 }}>
          <T size={12.5} color="#fac285">
            L’heure de la carte n’est pas encore synchronisée : elle est repartie d’une coupure sans
            avoir revu le réseau. Ce qui a été daté depuis peut être décalé — l’app le signale, elle
            ne corrige rien.
          </T>
        </Notice>
      ) : null}
      {sync.suspended ? <Notice tone="warn" style={{ marginHorizontal: 16, marginBottom: 14 }}>{sync.suspended}</Notice> : null}
      {sync.error ? <Notice tone="error" style={{ marginHorizontal: 16, marginBottom: 14 }}>{sync.error}</Notice> : null}
      <Button label="Rattraper maintenant" icon="refresh" onPress={() => void syncNow()} loading={sync.running} disabled={collector !== 'ok' || !!sync.suspended} style={{ marginHorizontal: 16, marginBottom: 24 }} />

      <Section>Sauvegarde</Section>
      {reminder.due ? <Notice tone="warn" style={{ marginHorizontal: 16, marginBottom: 12 }}>Aucune sauvegarde depuis une semaine.</Notice> : null}
      <T size={12.5} color={colors.textSoft} style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        Le collecteur est la seule mémoire de l’historique ; ce téléphone en garde une copie. Le fichier exporté la restaure sur un téléphone neuf, et garde les réglages du réveil pour le remettre en état.
      </T>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <Button label="Exporter vers le Drive" kind="primary" onPress={exportNow} loading={busy === 'export'} disabled={busy !== null || !counts} />
        <Button label="Restaurer une sauvegarde" onPress={restore} loading={busy === 'restore'} disabled={busy !== null} />
      </View>
      {message ? <Notice tone={message.tone} style={{ marginHorizontal: 16, marginTop: 14 }}>{message.text}</Notice> : null}
      <T size={11.5} color={colors.textFaint} style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        Réglages exportés : ceux que le collecteur sert — alarmes visibles (heure, jours, PowerWake), lampe, coucher de soleil, durée du rappel. Le thème et le son de chaque alarme n’y sont pas encore.
      </T>
    </Screen>
  );
}
