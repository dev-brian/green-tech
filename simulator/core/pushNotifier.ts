/**
 * Notificaciones push de alertas críticas (T6.5 #52, contrato v0.2 §2.5–2.6).
 *
 * Cuando el motor crea una alerta `critical`, o una alerta `warn` activa sube a
 * `critical`, se envía un push FCM a los tokens de todos los miembros del
 * invernadero (users/{uid}/fcmTokens). Los tokens que FCM reporta como
 * inválidos o dados de baja se borran para no volver a intentarlos.
 *
 * El envío nunca debe romper la ingesta: los errores se registran y se ignoran.
 */

import { HYDROPONIC_VARIABLES } from './hydroponicModel.ts';
import type { AlertRecord } from './alertAndActuatorEngine.ts';

/** Puerto que usa el motor de alertas; permite probarlo sin Firebase. */
export interface AlertPushNotifier {
  notifyCriticalAlert(greenhouseId: string, alert: AlertRecord): Promise<void>;
}

export interface PushMessageContent {
  title: string;
  body: string;
  /** FCM solo acepta strings en `data`. */
  data: Record<string, string>;
}

/** Arma el título, cuerpo y datos del push para una alerta crítica. */
export function buildCriticalAlertMessage(
  greenhouseId: string,
  alert: AlertRecord,
): PushMessageContent {
  const meta = HYDROPONIC_VARIABLES[alert.variable];
  const label = meta?.label ?? alert.variable;
  const unit = meta?.unit ?? '';
  return {
    title: `Alerta crítica: ${label}`,
    body: `${label} en ${alert.zoneId}: ${alert.value} ${unit}`.trim(),
    data: {
      type: 'alert',
      greenhouseId,
      alertId: alert.id,
      zoneId: alert.zoneId,
      variable: alert.variable,
      severity: alert.severity,
      value: String(alert.value),
    },
  };
}

/** Códigos de FCM que indican que el token ya no sirve y debe borrarse. */
const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface SendResultLike {
  success: boolean;
  error?: { code?: string } | null;
}

/** Devuelve las posiciones de los tokens que FCM rechazó como inválidos. */
export function findStaleTokenIndexes(responses: SendResultLike[]): number[] {
  const stale: number[] = [];
  responses.forEach((r, i) => {
    if (!r.success && r.error?.code && STALE_TOKEN_CODES.has(r.error.code)) {
      stale.push(i);
    }
  });
  return stale;
}

/** Notificador que no hace nada (modo memoria y pruebas). */
export class NoopPushNotifier implements AlertPushNotifier {
  async notifyCriticalAlert(): Promise<void> {}
}

/** Notificador en memoria que solo registra las llamadas (pruebas). */
export class RecordingPushNotifier implements AlertPushNotifier {
  public calls: Array<{ greenhouseId: string; alert: AlertRecord }> = [];
  async notifyCriticalAlert(greenhouseId: string, alert: AlertRecord): Promise<void> {
    this.calls.push({ greenhouseId, alert });
  }
}
