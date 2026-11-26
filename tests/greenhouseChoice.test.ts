import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeGreenhouse,
  findGreenhouse,
  resolveAnswer,
  sortGreenhouses,
  type GreenhouseOption,
} from '../greenhouse-sim/greenhouseChoice.ts';

const gh = (id: string, name: string, createdAt: string | null = null): GreenhouseOption => ({
  id,
  name,
  zoneCount: 2,
  memberCount: 1,
  adminEmails: ['admin@ejemplo.com'],
  createdAt,
});

const list = sortGreenhouses([
  gh('aaa', 'invernadero utt', '2026-10-01T00:00:00Z'),
  gh('bbb', 'Demo clase', '2026-11-25T00:00:00Z'),
  gh('ccc', 'Demo casa', '2026-11-20T00:00:00Z'),
]);

describe('elegir invernadero del simulador', () => {
  it('ordena del más nuevo al más viejo', () => {
    assert.deepEqual(list.map((g) => g.id), ['bbb', 'ccc', 'aaa']);
  });

  it('encuentra por id, por nombre sin mayúsculas ni acentos y por parte única', () => {
    assert.equal(findGreenhouse(list, 'aaa').match?.id, 'aaa');
    assert.equal(findGreenhouse(list, 'DEMO CLASE').match?.id, 'bbb');
    assert.equal(findGreenhouse(list, 'utt').match?.id, 'aaa');
  });

  it('si la parte del nombre coincide con varios, no elige y los regresa', () => {
    const r = findGreenhouse(list, 'demo');
    assert.equal(r.match, null);
    assert.equal(r.candidates.length, 2);
  });

  it('el menú acepta número, nombre o Enter para el sugerido', () => {
    assert.equal(resolveAnswer(list, '3', null)?.id, 'aaa');
    assert.equal(resolveAnswer(list, 'demo casa', null)?.id, 'ccc');
    assert.equal(resolveAnswer(list, '', list[0])?.id, 'bbb');
    assert.equal(resolveAnswer(list, '9', list[0]), null);
  });

  it('describe con zonas, miembros y admin', () => {
    assert.equal(
      describeGreenhouse(list[0]),
      'Demo clase · 2 zonas · 1 miembro · admin: admin@ejemplo.com · creado 2026-11-25',
    );
  });
});
