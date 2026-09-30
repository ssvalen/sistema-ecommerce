import { randomUUID } from 'node:crypto';

export type SimulatedResult = 'APPROVED' | 'DECLINED';

// Pago simulado: local e instantáneo, por eso puede ejecutarse con los locks tomados.
export function simulatePayment(result: SimulatedResult): { approved: boolean; reference: string } {
  return { approved: result === 'APPROVED', reference: `SIM-${randomUUID()}` };
}
