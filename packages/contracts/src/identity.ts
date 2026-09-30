import { z } from 'zod';

export const UserRoleSchema = z.enum(['CUSTOMER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(['ACTIVE', 'BLOCKED']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

const NameSchema = z.string().trim().min(1).max(100).meta({ example: 'Ana López' });

const EmailSchema = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email({ error: 'El email no es válido.' }))
  .meta({ example: 'ana@example.com' });

export const RegisterBodySchema = z
  .strictObject({
    name: NameSchema,
    email: EmailSchema,
    password: z.string().min(8).max(128).meta({ example: 'contraseña-segura' }),
  })
  .meta({ id: 'RegisterBody' });
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z
  .strictObject({
    email: EmailSchema,
    password: z.string().min(1).max(128).meta({ example: 'contraseña-segura' }),
  })
  .meta({ id: 'LoginBody' });
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const UserSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    role: UserRoleSchema,
    status: UserStatusSchema,
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'User' });
export type User = z.infer<typeof UserSchema>;

export const UpdateUserStatusBodySchema = z
  .strictObject({ status: UserStatusSchema })
  .meta({ id: 'UpdateUserStatusBody' });
export type UpdateUserStatusBody = z.infer<typeof UpdateUserStatusBodySchema>;
