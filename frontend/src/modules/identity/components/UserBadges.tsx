import type { UserRole, UserStatus } from '@sistema-e/contracts';
import { Badge } from '@/shared/ui/feedback';

export function RoleBadge({ role }: { role: UserRole }) {
  return role === 'ADMIN' ? (
    <Badge tone="blue">Administrador</Badge>
  ) : (
    <Badge tone="slate">Cliente</Badge>
  );
}

export function StatusBadge({ status }: { status: UserStatus }) {
  return status === 'ACTIVE' ? (
    <Badge tone="green">Activa</Badge>
  ) : (
    <Badge tone="red">Bloqueada</Badge>
  );
}
