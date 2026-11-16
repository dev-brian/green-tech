/**
 * Escenarios incluidos. Cada uno es una lista de comandos con su momento
 * (segundos de tiempo simulado). Los pasos `cleanup` dejan el invernadero
 * como estaba aunque el escenario se detenga a la mitad.
 */

import type { Scenario } from '../model/types.ts';

const MIN = 60;
const HOUR = 3600;

export const BUILTIN_SCENARIOS: Scenario[] = [
  {
    id: 'sube-ph',
    name: 'Sube el pH',
    category: 'solucion',
    description:
      'Entra agua alcalina al tanque de la zona 1 y la dosificadora de ácido está vacía. A la hora se repone el ácido.',
    expect:
      'pH en amarillo y después en rojo con alerta nueva. Al reponer el ácido baja y la alerta se resuelve sola.',
    suggestedSpeed: 60,
    steps: [
      { at: 0, command: { type: 'device.fault', zone: 'zona-1', device: 'phDoser', fault: 'failed' } },
      { at: 0, command: { type: 'tank.disturb', zone: 'zona-1', dPh: 0.9 } },
      { at: 1 * HOUR, cleanup: true, command: { type: 'device.fault', zone: 'zona-1', device: 'phDoser', fault: 'none' } },
    ],
  },
  {
    id: 'sobredosis-acido',
    name: 'Sobredosis de ácido',
    category: 'solucion',
    description:
      'La dosificadora de ácido de la zona 2 se queda pegada encendida durante una hora. Después se repara y se neutraliza el tanque.',
    expect: 'pH cae a amarillo y luego a rojo por abajo de 5.0.',
    suggestedSpeed: 60,
    steps: [
      { at: 0, command: { type: 'device.fault', zone: 'zona-2', device: 'phDoser', fault: 'stuckOn' } },
      { at: 60 * MIN, cleanup: true, command: { type: 'device.fault', zone: 'zona-2', device: 'phDoser', fault: 'none' } },
      { at: 65 * MIN, command: { type: 'tank.disturb', zone: 'zona-2', dPh: 1.3 } },
    ],
  },
  {
    id: 'sin-nutrientes',
    name: 'Se acaban los nutrientes',
    category: 'solucion',
    description:
      'La dosificadora de nutrientes de la zona 2 deja de responder. Las plantas siguen consumiendo sales durante 12 horas.',
    expect: 'EC baja poco a poco: amarillo a las 6 horas simuladas y rojo cerca de las 10.',
    suggestedSpeed: 300,
    steps: [
      { at: 0, command: { type: 'device.fault', zone: 'zona-2', device: 'nutrientDoser', fault: 'failed' } },
      { at: 12 * HOUR, cleanup: true, command: { type: 'device.fault', zone: 'zona-2', device: 'nutrientDoser', fault: 'none' } },
    ],
  },
  {
    id: 'falla-bomba-llenado',
    name: 'Falla la bomba de llenado',
    category: 'equipos',
    description:
      'La bomba que repone agua al tanque de la zona 2 no arranca. El cultivo sigue transpirando y el nivel baja.',
    expect:
      'Nivel del tanque en amarillo (40 %) y rojo (20 %). El backend apaga la recirculación para proteger la bomba.',
    suggestedSpeed: 300,
    steps: [
      { at: 0, command: { type: 'device.fault', zone: 'zona-2', device: 'refillValve', fault: 'failed' } },
      { at: 24 * HOUR, cleanup: true, command: { type: 'device.fault', zone: 'zona-2', device: 'refillValve', fault: 'none' } },
    ],
  },
  {
    id: 'fuga-tanque',
    name: 'Fuga en el tanque',
    category: 'equipos',
    description:
      'El tanque de la zona 3 pierde 150 L/h, más de lo que repone la bomba de llenado. A los 90 minutos se repara.',
    expect: 'Nivel cae rápido a amarillo y rojo; EC y pH se mueven por la dilución con agua de la red.',
    suggestedSpeed: 60,
    steps: [
      { at: 0, command: { type: 'tank.leak', zone: 'zona-3', litersPerHour: 150 } },
      { at: 90 * MIN, cleanup: true, command: { type: 'tank.leak', zone: 'zona-3', litersPerHour: 0 } },
    ],
  },
  {
    id: 'falla-bomba-recirculacion',
    name: 'Falla la bomba de recirculación',
    category: 'equipos',
    description:
      'La bomba de la zona 3 se detiene una hora. Los canales NFT se vacían y las raíces se secan.',
    expect:
      'El nivel del tanque sube unos puntos (regresa el agua de los canales) y pH y EC dejan de moverse. No hay alerta directa: ninguna de las 7 variables mide flujo.',
    suggestedSpeed: 60,
    steps: [
      { at: 0, command: { type: 'device.fault', zone: 'zona-3', device: 'recirculationPump', fault: 'failed' } },
      { at: 60 * MIN, cleanup: true, command: { type: 'device.fault', zone: 'zona-3', device: 'recirculationPump', fault: 'none' } },
    ],
  },
  {
    id: 'corte-de-luz',
    name: 'Corte de luz',
    category: 'energia',
    description:
      'Al anochecer se va la electricidad 45 minutos. Bombas, ventilación y lámparas se apagan; los nodos de sensores siguen con batería.',
    expect: 'Luz en rojo en todas las zonas y alertas críticas. Al volver la electricidad se resuelven solas.',
    suggestedSpeed: 60,
    steps: [
      { at: 0, command: { type: 'clock.set', hour: 20 } },
      { at: 5 * MIN, command: { type: 'power.set', on: false } },
      { at: 50 * MIN, cleanup: true, command: { type: 'power.set', on: true } },
    ],
  },
  {
    id: 'apagon-total',
    name: 'Apagón total',
    category: 'energia',
    description:
      'Se va la electricidad y los nodos de sensores no tienen batería. Dura 7 minutos reales para que se note en las apps.',
    expect: 'Las zonas dejan de reportar y pasan a "sin datos" (gris) a los 5 minutos.',
    suggestedSpeed: 1,
    steps: [
      { at: 0, command: { type: 'power.set', on: false } },
      { at: 0, command: { type: 'node.set', zone: 'all', online: false } },
      { at: 7 * MIN, cleanup: true, command: { type: 'power.set', on: true } },
      { at: 7 * MIN, cleanup: true, command: { type: 'node.set', zone: 'all', online: true } },
    ],
  },
  {
    id: 'ola-de-calor',
    name: 'Ola de calor',
    category: 'clima',
    description: 'La temperatura exterior sube 12 °C durante 3 horas.',
    expect:
      'Temperatura del aire en rojo y humedad baja. La solución se calienta con retraso. El backend ordena ventilación.',
    suggestedSpeed: 60,
    steps: [
      { at: 0, command: { type: 'env.set', tempOffset: 12 } },
      { at: 3 * HOUR, cleanup: true, command: { type: 'env.set', tempOffset: 0 } },
    ],
  },
  {
    id: 'sin-internet',
    name: 'Sin internet',
    category: 'red',
    description:
      'Se cae la conexión del invernadero 7 minutos reales. Los nodos siguen midiendo y guardan las lecturas.',
    expect:
      'Zonas congeladas y luego "sin datos". Al volver llegan de golpe las lecturas pendientes con su hora original.',
    suggestedSpeed: 1,
    steps: [
      { at: 0, command: { type: 'network.set', online: false } },
      { at: 7 * MIN, cleanup: true, command: { type: 'network.set', online: true } },
    ],
  },
  {
    id: 'sonda-ph-descalibrada',
    name: 'Sonda de pH descalibrada',
    category: 'sensores',
    description:
      'La sonda de pH de la zona 1 marca 0.8 de más. El controlador le cree y dosifica ácido de sobra. A la hora se recalibra.',
    expect:
      'Alerta falsa de pH alto que se "resuelve" sola; al recalibrar aparece el pH real, bajo, en amarillo.',
    suggestedSpeed: 60,
    steps: [
      { at: 0, command: { type: 'sensor.fault', zone: 'zona-1', variable: 'ph', mode: 'bias', bias: 0.8 } },
      { at: 1 * HOUR, cleanup: true, command: { type: 'sensor.fault', zone: 'zona-1', variable: 'ph', mode: 'ok' } },
      { at: 80 * MIN, command: { type: 'tank.disturb', zone: 'zona-1', dPh: 0.7 } },
    ],
  },
  {
    id: 'sonda-desconectada',
    name: 'Sonda desconectada',
    category: 'sensores',
    description:
      'Se suelta la sonda de temperatura de la solución en la zona 1 y reporta -127 °C. Dura 7 minutos reales.',
    expect:
      'La ingesta rechaza cada lectura con 422 (fuera de rango físico) y la zona 1 pasa a "sin datos" a los 5 minutos.',
    suggestedSpeed: 1,
    steps: [
      { at: 0, command: { type: 'sensor.fault', zone: 'zona-1', variable: 'solutionTemp', mode: 'disconnected' } },
      { at: 7 * MIN, cleanup: true, command: { type: 'sensor.fault', zone: 'zona-1', variable: 'solutionTemp', mode: 'ok' } },
    ],
  },
  {
    id: 'demo-guiada',
    name: 'Demo guiada',
    category: 'demo',
    description:
      'Recorrido para presentar: sube el pH en la zona 1, se repara, y al anochecer hay un corte de luz. Unos 5 minutos a x20.',
    expect:
      'Alerta de pH que escala a crítica y se resuelve; después luz en rojo en las tres zonas y recuperación.',
    suggestedSpeed: 20,
    steps: [
      { at: 0, command: { type: 'clock.set', hour: 19.5 } },
      { at: 2 * MIN, command: { type: 'device.fault', zone: 'zona-1', device: 'phDoser', fault: 'failed' } },
      { at: 2 * MIN, command: { type: 'tank.disturb', zone: 'zona-1', dPh: 0.8 } },
      { at: 20 * MIN, command: { type: 'tank.disturb', zone: 'zona-1', dPh: 0.4 } },
      { at: 30 * MIN, cleanup: true, command: { type: 'device.fault', zone: 'zona-1', device: 'phDoser', fault: 'none' } },
      { at: 65 * MIN, command: { type: 'power.set', on: false } },
      { at: 95 * MIN, cleanup: true, command: { type: 'power.set', on: true } },
    ],
  },
].map((s) => ({ ...s, builtin: true }) as Scenario);
