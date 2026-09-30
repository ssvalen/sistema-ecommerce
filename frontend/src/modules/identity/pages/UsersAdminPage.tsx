import type { User } from '@sistema-e/contracts';
import { Link } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { usePageParam } from '@/shared/lib/pagination';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ErrorState, PageHeader } from '@/shared/ui/feedback';
import { RoleBadge, StatusBadge } from '../components/UserBadges';
import { UserStatusControl } from '../components/UserStatusControl';
import { useSession } from '../session';
import { useUsers } from '../users';

export function UsersAdminPage() {
  const [page, setPage] = usePageParam();
  const { user: currentUser } = useSession();
  const users = useUsers(page);

  const columns: Column<User>[] = [
    {
      header: 'Nombre',
      cell: (user) => (
        <Link
          to={`/admin/users/${user.id}`}
          className="font-medium text-slate-800 hover:text-blue-700"
        >
          {user.name}
          {user.id === currentUser?.id && <span className="ml-2 text-xs text-muted">(tú)</span>}
        </Link>
      ),
    },
    { header: 'Email', cell: (user) => user.email },
    { header: 'Rol', cell: (user) => <RoleBadge role={user.role} /> },
    { header: 'Estado', cell: (user) => <StatusBadge status={user.status} /> },
    {
      header: 'Registro',
      cell: (user) => formatDate(user.createdAt),
      className: 'whitespace-nowrap',
    },
    { header: 'Acciones', cell: (user) => <UserStatusControl user={user} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Consulta las cuentas y bloquea o desbloquea el acceso."
      />
      {users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={users.data?.items}
          rowKey={(user) => user.id}
          loading={users.isFetching}
          emptyMessage="No hay usuarios registrados."
          pagination={
            users.data && {
              page,
              totalPages: users.data.meta.totalPages,
              total: users.data.meta.total,
              onPageChange: setPage,
            }
          }
        />
      )}
    </div>
  );
}
