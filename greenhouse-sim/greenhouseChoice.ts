/**
 * Elegir el invernadero del simulador sin ir a la consola de Firebase.
 * Funciones puras (sin Firestore) para poder probarlas.
 */

export interface GreenhouseOption {
  id: string;
  name: string;
  zoneCount: number;
  memberCount: number;
  adminEmails: string[];
  createdAt: string | null;
}

/** Más reciente primero: el invernadero recién creado para la demo sale arriba. */
export function sortGreenhouses(list: GreenhouseOption[]): GreenhouseOption[] {
  return [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Busca por id exacto, por nombre exacto (sin mayúsculas ni acentos) o por
 * parte del nombre si solo hay uno que coincida. Si hay varios, los regresa
 * todos para que la persona elija.
 */
export function findGreenhouse(
  list: GreenhouseOption[],
  query: string,
): { match: GreenhouseOption | null; candidates: GreenhouseOption[] } {
  const q = normalize(query);
  if (!q) return { match: null, candidates: [] };
  const byId = list.find((g) => g.id === query.trim());
  if (byId) return { match: byId, candidates: [byId] };
  const exact = list.filter((g) => normalize(g.name) === q);
  if (exact.length === 1) return { match: exact[0], candidates: exact };
  if (exact.length > 1) return { match: null, candidates: exact };
  const partial = list.filter((g) => normalize(g.name).includes(q));
  return { match: partial.length === 1 ? partial[0] : null, candidates: partial };
}

/** Respuesta del menú: número de la lista, id o nombre. Vacío = el sugerido. */
export function resolveAnswer(
  list: GreenhouseOption[],
  answer: string,
  suggested: GreenhouseOption | null,
): GreenhouseOption | null {
  const a = answer.trim();
  if (!a) return suggested;
  if (/^\d+$/.test(a)) {
    const n = Number(a);
    return n >= 1 && n <= list.length ? list[n - 1] : null;
  }
  return findGreenhouse(list, a).match;
}

export function describeGreenhouse(g: GreenhouseOption): string {
  const zonas = g.zoneCount === 1 ? '1 zona' : `${g.zoneCount} zonas`;
  const miembros = g.memberCount === 1 ? '1 miembro' : `${g.memberCount} miembros`;
  const admin = g.adminEmails.length > 0 ? ` · admin: ${g.adminEmails.join(', ')}` : '';
  const fecha = g.createdAt ? ` · creado ${g.createdAt.slice(0, 10)}` : '';
  return `${g.name || '(sin nombre)'} · ${zonas} · ${miembros}${admin}${fecha}`;
}
