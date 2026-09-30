import { z } from 'zod';

const TYPE_MESSAGES: Record<string, string> = {
  string: 'Debe ser texto.',
  number: 'Debe ser un número.',
  int: 'Debe ser un número entero.',
  boolean: 'Debe ser verdadero o falso.',
  array: 'Debe ser una lista.',
  object: 'Debe ser un objeto.',
};

function limitMessage(
  origin: string,
  bound: number | bigint | Date,
  inclusive: boolean,
  isMin: boolean,
) {
  const n = String(bound);
  if (origin === 'string') {
    if (isMin && n === '1') return 'No puede estar vacío.';
    return isMin
      ? `Debe tener al menos ${n} caracteres.`
      : `Debe tener como máximo ${n} caracteres.`;
  }
  if (origin === 'array') {
    return isMin ? `Debe tener al menos ${n} elementos.` : `Debe tener como máximo ${n} elementos.`;
  }
  if (isMin) return inclusive ? `Debe ser mayor o igual que ${n}.` : `Debe ser mayor que ${n}.`;
  return inclusive ? `Debe ser menor o igual que ${n}.` : `Debe ser menor que ${n}.`;
}

const spanishMessages: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined) {
        return issue.expected === 'object' ? 'Falta el cuerpo de la solicitud.' : 'Es obligatorio.';
      }
      return TYPE_MESSAGES[issue.expected];
    case 'too_small':
      return limitMessage(issue.origin, issue.minimum, issue.inclusive ?? true, true);
    case 'too_big':
      return limitMessage(issue.origin, issue.maximum, issue.inclusive ?? true, false);
    case 'unrecognized_keys':
      return issue.keys.length === 1
        ? `Campo no permitido: ${issue.keys[0]}.`
        : `Campos no permitidos: ${issue.keys.join(', ')}.`;
    case 'invalid_value':
      return `Debe ser uno de: ${issue.values.map(String).join(', ')}.`;
    default:
      return undefined;
  }
};

// Mensajes de validación en español. Los usan el backend y los formularios del frontend.
export function useSpanishMessages(): void {
  z.config(z.locales.es());
  z.config({ customError: spanishMessages });
}
