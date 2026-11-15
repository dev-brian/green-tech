/**
 * Envío real de push con Firebase Cloud Messaging usando Admin SDK (T6.5 #52).
 * Lee los miembros de greenhouses/{id}.memberIds, junta sus tokens de
 * users/{uid}/fcmTokens y envía la alerta crítica a todos (PWA y app Android).
 */

import { getApps } from 'firebase-admin/app';
import { getMessaging, type Messaging, type MulticastMessage } from 'firebase-admin/messaging';
import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import type { AlertRecord } from './alertAndActuatorEngine.ts';
import {
  buildCriticalAlertMessage,
  findStaleTokenIndexes,
  type AlertPushNotifier,
} from './pushNotifier.ts';
import { initFirestoreAdmin } from './firestoreStorage.ts';

/** FCM acepta hasta 500 tokens por envío multicast. */
const MAX_TOKENS_PER_BATCH = 500;

export interface FcmPushNotifierOptions {
  db?: Firestore;
  messaging?: Messaging;
  /** URL pública de la PWA (https) para abrir al tocar la notificación. */
  pwaUrl?: string;
  log?: (msg: string) => void;
}

export class FcmPushNotifier implements AlertPushNotifier {
  private db: Firestore;
  private messaging: Messaging;
  private pwaUrl?: string;
  private log: (msg: string) => void;

  constructor(options: FcmPushNotifierOptions = {}) {
    this.db = options.db ?? initFirestoreAdmin();
    this.messaging = options.messaging ?? getMessaging(getApps()[0]);
    const url = options.pwaUrl ?? process.env.PWA_URL;
    this.pwaUrl = url && url.startsWith('https://') ? url : undefined;
    this.log = options.log ?? ((msg) => console.log(msg));
  }

  async notifyCriticalAlert(greenhouseId: string, alert: AlertRecord): Promise<void> {
    try {
      const targets = await this.collectTokens(greenhouseId);
      if (targets.length === 0) {
        this.log(`[Push] ${greenhouseId}: sin tokens registrados, no se envía push.`);
        return;
      }

      const content = buildCriticalAlertMessage(greenhouseId, alert);
      let sent = 0;
      let removed = 0;

      for (let i = 0; i < targets.length; i += MAX_TOKENS_PER_BATCH) {
        const batch = targets.slice(i, i + MAX_TOKENS_PER_BATCH);
        const message: MulticastMessage = {
          tokens: batch.map((t) => t.token),
          notification: { title: content.title, body: content.body },
          data: content.data,
          android: {
            priority: 'high',
            notification: { tag: `alert-${alert.zoneId}-${alert.variable}` },
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: {
              title: content.title,
              body: content.body,
              tag: `alert-${alert.zoneId}-${alert.variable}`,
              requireInteraction: true,
            },
            ...(this.pwaUrl ? { fcmOptions: { link: `${this.pwaUrl}#/alerts` } } : {}),
          },
        };

        const res = await this.messaging.sendEachForMulticast(message);
        sent += res.successCount;

        const stale = findStaleTokenIndexes(res.responses);
        await Promise.all(stale.map((idx) => batch[idx].ref.delete().catch(() => undefined)));
        removed += stale.length;
      }

      this.log(
        `[Push] ${greenhouseId}: alerta ${alert.id} (${alert.variable} en ${alert.zoneId}) enviada a ${sent}/${targets.length} dispositivos; ${removed} tokens inválidos borrados.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[Push] Error al enviar la alerta ${alert.id}: ${msg}`);
    }
  }

  private async collectTokens(
    greenhouseId: string,
  ): Promise<Array<{ token: string; ref: DocumentReference }>> {
    const gh = await this.db.collection('greenhouses').doc(greenhouseId).get();
    const memberIds = (gh.data()?.memberIds as unknown[] | undefined) ?? [];
    const uids = memberIds.filter((id): id is string => typeof id === 'string' && id.length > 0);

    const snaps = await Promise.all(
      uids.map((uid) => this.db.collection('users').doc(uid).collection('fcmTokens').get()),
    );

    const seen = new Set<string>();
    const out: Array<{ token: string; ref: DocumentReference }> = [];
    for (const snap of snaps) {
      for (const d of snap.docs) {
        const token = d.data().token;
        if (typeof token === 'string' && token && !seen.has(token)) {
          seen.add(token);
          out.push({ token, ref: d.ref });
        }
      }
    }
    return out;
  }
}
