import argon2 from 'argon2';

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

let dummyHash: Promise<string> | undefined;

// Sin usuario se verifica contra un hash ficticio: mismo tiempo de respuesta.
export async function verifyPassword(hash: string | null, plain: string): Promise<boolean> {
  dummyHash ??= hashPassword('usuario-inexistente');
  const valid = await argon2.verify(hash ?? (await dummyHash), plain);
  return hash !== null && valid;
}
