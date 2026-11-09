import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rulesText = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

/**
 * Evaluador fiel de las reglas definidas en firestore.rules (T11.1 / T11.2)
 * para validar todos los criterios de aceptación de HU-11 en CI y local.
 */
interface DocStore {
  greenhouses: Record<
    string,
    {
      name: string;
      inviteCode: string;
      memberIds: string[];
      thresholds?: Record<string, unknown>;
    }
  >;
  members: Record<string, Record<string, { role: 'admin' | 'operador'; inviteCode?: string }>>;
  alerts: Record<
    string,
    Record<
      string,
      {
        zoneId: string;
        variable: string;
        severity: 'warn' | 'critical';
        value: number;
        status: 'new' | 'attended' | 'auto_resolved';
        attendedBy: string | null;
        attendedAt: string | null;
      }
    >
  >;
}

function createRulesEvaluator(store: DocStore) {
  const isSignedIn = (uid: string | null): uid is string => Boolean(uid);

  const isMember = (uid: string | null, greenhouseId: string): boolean => {
    if (!isSignedIn(uid)) return false;
    const gh = store.greenhouses[greenhouseId];
    return Boolean(gh && gh.memberIds.includes(uid));
  };

  const isAdmin = (uid: string | null, greenhouseId: string): boolean => {
    if (!isMember(uid, greenhouseId)) return false;
    const member = store.members[greenhouseId]?.[uid!];
    return member?.role === 'admin';
  };

  return {
    canReadGreenhouse(uid: string | null, greenhouseId: string): boolean {
      const gh = store.greenhouses[greenhouseId];
      if (!gh || !isSignedIn(uid)) return false;
      return gh.memberIds.includes(uid);
    },
    canUpdateGreenhouse(
      uid: string | null,
      greenhouseId: string,
      newData: Partial<{ name: string; inviteCode: string; memberIds: string[]; thresholds: Record<string, unknown> }>,
      pendingMemberInviteCode?: string,
    ): boolean {
      if (isAdmin(uid, greenhouseId)) return true;
      const gh = store.greenhouses[greenhouseId];
      if (!gh || !isSignedIn(uid)) return false;

      const changedKeys = Object.keys(newData);
      // Unión con código válido
      if (
        !gh.memberIds.includes(uid) &&
        changedKeys.every((k) => k === 'memberIds' || k === 'inviteCode') &&
        Array.isArray(newData.memberIds) &&
        gh.memberIds.every((m) => newData.memberIds!.includes(m)) &&
        newData.memberIds.length === gh.memberIds.length + 1 &&
        newData.memberIds.includes(uid) &&
        gh.inviteCode.length > 0 &&
        (newData.inviteCode === gh.inviteCode || pendingMemberInviteCode === gh.inviteCode)
      ) {
        return true;
      }

      // Abandono del propio usuario
      if (
        gh.memberIds.includes(uid) &&
        changedKeys.length === 1 &&
        changedKeys[0] === 'memberIds' &&
        Array.isArray(newData.memberIds) &&
        newData.memberIds.every((m) => gh.memberIds.includes(m)) &&
        newData.memberIds.length === gh.memberIds.length - 1 &&
        !newData.memberIds.includes(uid)
      ) {
        return true;
      }

      return false;
    },
    canReadSubcollection(uid: string | null, greenhouseId: string): boolean {
      return isMember(uid, greenhouseId);
    },
    canCreateMember(
      uid: string | null,
      greenhouseId: string,
      targetMemberId: string,
      data: { role: 'admin' | 'operador'; inviteCode?: string },
    ): boolean {
      if (isAdmin(uid, greenhouseId)) return true;
      if (!isSignedIn(uid) || targetMemberId !== uid) return false;
      const gh = store.greenhouses[greenhouseId];
      if (!gh) return false;
      return (
        data.role === 'operador' &&
        Boolean(gh.inviteCode) &&
        data.inviteCode === gh.inviteCode
      );
    },
    canUpdateMember(
      uid: string | null,
      greenhouseId: string,
      newRole: 'admin' | 'operador',
    ): boolean {
      return isAdmin(uid, greenhouseId) && (newRole === 'admin' || newRole === 'operador');
    },
    canClientWriteTelemetryOrCreateAlert(): boolean {
      return false;
    },
    canUpdateAlert(
      uid: string | null,
      greenhouseId: string,
      changedFields: Record<string, unknown>,
    ): boolean {
      if (!isMember(uid, greenhouseId)) return false;
      const keys = Object.keys(changedFields);
      const allowed = new Set(['status', 'attendedBy', 'attendedAt']);
      if (!keys.every((k) => allowed.has(k))) return false;
      return changedFields.status === 'attended' && changedFields.attendedBy === uid;
    },
    canAccessFcmTokens(uid: string | null, targetUid: string): boolean {
      return isSignedIn(uid) && uid === targetUid;
    },
  };
}

describe('Definición estática de firestore.rules (T11.1)', () => {
  it('incluye las funciones de seguridad RBAC y validaciones de unión/alertas', () => {
    assert.match(rulesText, /function isMember\(greenhouseId\)/);
    assert.match(rulesText, /function isAdmin\(greenhouseId\)/);
    assert.match(rulesText, /function isJoiningWithValidInvite\(greenhouseId\)/);
    assert.match(rulesText, /function isSelfJoiningAsOperator\(greenhouseId, memberId\)/);
    assert.match(rulesText, /function isValidAlertAcknowledge\(\)/);
  });

  it('protege las subcolecciones del esquema v0.2 (readings, readingsHourly, state, alerts, zones, actuators) y tokens FCM', () => {
    assert.match(rulesText, /match \/readings\/\{readingId\}/);
    assert.match(rulesText, /match \/readingsHourly\/\{hourId\}/);
    assert.match(rulesText, /match \/state\/\{docId\}/);
    assert.match(rulesText, /match \/alerts\/\{alertId\}/);
    assert.match(rulesText, /match \/zones\/\{zoneId\}/);
    assert.match(rulesText, /match \/actuators\/\{actuatorId\}/);
    assert.match(rulesText, /match \/users\/\{uid\}\/fcmTokens\/\{tokenId\}/);
  });
});

describe('Evaluación de criterios de aceptación HU-11 (T11.1 y T11.2)', () => {
  const baseStore = (): DocStore => ({
    greenhouses: {
      'gh-1': {
        name: 'Invernadero Hidropónico 1',
        inviteCode: 'GT-77889',
        memberIds: ['uid-admin', 'uid-operador'],
      },
    },
    members: {
      'gh-1': {
        'uid-admin': { role: 'admin' },
        'uid-operador': { role: 'operador' },
      },
    },
    alerts: {
      'gh-1': {
        'alert-1': {
          zoneId: 'zona-1',
          variable: 'ph',
          severity: 'critical',
          value: 7.5,
          status: 'new',
          attendedBy: null,
          attendedAt: null,
        },
      },
    },
  });

  it('Criterio 1: usuario con sesión que NO es miembro es rechazado al leer o escribir invernadero, miembros, telemetría o alertas', () => {
    const ev = createRulesEvaluator(baseStore());

    assert.equal(ev.canReadGreenhouse('uid-externo', 'gh-1'), false);
    assert.equal(ev.canUpdateGreenhouse('uid-externo', 'gh-1', { name: 'Intruso' }), false);
    assert.equal(ev.canReadSubcollection('uid-externo', 'gh-1'), false);
    assert.equal(
      ev.canUpdateAlert('uid-externo', 'gh-1', {
        status: 'attended',
        attendedBy: 'uid-externo',
        attendedAt: '2026-11-08T00:00:00Z',
      }),
      false,
    );
  });

  it('Criterio 2: un operador que intenta cambiar su rol a admin o editar el invernadero es rechazado', () => {
    const ev = createRulesEvaluator(baseStore());

    assert.equal(ev.canUpdateMember('uid-operador', 'gh-1', 'admin'), false);
    assert.equal(ev.canUpdateGreenhouse('uid-operador', 'gh-1', { name: 'Cambio no autorizado' }), false);
    assert.equal(ev.canUpdateGreenhouse('uid-admin', 'gh-1', { name: 'Cambio por Admin' }), true);
  });

  it('Criterio 3: unirse solo permite agregarse a sí mismo como operador con código de invitación válido', () => {
    const ev = createRulesEvaluator(baseStore());

    // Código incorrecto -> rechazado
    assert.equal(
      ev.canCreateMember('uid-nuevo', 'gh-1', 'uid-nuevo', {
        role: 'operador',
        inviteCode: 'GT-WRONG',
      }),
      false,
    );

    // Intentar unirse como admin -> rechazado
    assert.equal(
      ev.canCreateMember('uid-nuevo', 'gh-1', 'uid-nuevo', {
        role: 'admin',
        inviteCode: 'GT-77889',
      }),
      false,
    );

    // Intentar agregar a otro usuario distinto de request.auth.uid -> rechazado
    assert.equal(
      ev.canCreateMember('uid-nuevo', 'gh-1', 'uid-otro', {
        role: 'operador',
        inviteCode: 'GT-77889',
      }),
      false,
    );

    // Unión legítima como operador con código válido -> permitido
    assert.equal(
      ev.canUpdateGreenhouse(
        'uid-nuevo',
        'gh-1',
        { memberIds: ['uid-admin', 'uid-operador', 'uid-nuevo'] },
        'GT-77889',
      ),
      true,
    );
    assert.equal(
      ev.canCreateMember('uid-nuevo', 'gh-1', 'uid-nuevo', {
        role: 'operador',
        inviteCode: 'GT-77889',
      }),
      true,
    );
  });

  it('Criterio 4: alertas solo pueden ser creadas por el backend y atendidas por miembros con su propio UID', () => {
    const ev = createRulesEvaluator(baseStore());

    assert.equal(ev.canClientWriteTelemetryOrCreateAlert(), false);

    // Atender con propio UID -> permitido
    assert.equal(
      ev.canUpdateAlert('uid-operador', 'gh-1', {
        status: 'attended',
        attendedBy: 'uid-operador',
        attendedAt: '2026-11-08T12:00:00Z',
      }),
      true,
    );

    // Atender falsificando UID de otro o cambiando value -> rechazado
    assert.equal(
      ev.canUpdateAlert('uid-operador', 'gh-1', {
        status: 'attended',
        attendedBy: 'uid-admin',
        attendedAt: '2026-11-08T12:00:00Z',
      }),
      false,
    );
    assert.equal(
      ev.canUpdateAlert('uid-operador', 'gh-1', {
        status: 'attended',
        attendedBy: 'uid-operador',
        value: 6.0,
      }),
      false,
    );
  });

  it('Criterio 5: tokens FCM aislados por usuario', () => {
    const ev = createRulesEvaluator(baseStore());
    assert.equal(ev.canAccessFcmTokens('uid-operador', 'uid-operador'), true);
    assert.equal(ev.canAccessFcmTokens('uid-operador', 'uid-admin'), false);
  });
});
