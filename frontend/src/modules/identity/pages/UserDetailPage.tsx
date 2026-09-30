import { faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { IdSchema } from '@sistema-e/contracts';
import { useParams } from 'react-router';
import { hasCode } from '@/shared/http/errors';
import { formatDateTime } from '@/shared/lib/format';
import { BackLink, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/shared/ui/feedback';
import { RoleBadge, StatusBadge } from '../components/UserBadges';
import { UserStatusControl } from '../components/UserStatusControl';
import { useUser } from '../users';

export function UserDetailPage() {
  const params = useParams();
  const parsed = IdSchema.safeParse(params.id);
  const user = useUser(parsed.success ? parsed.data : null);

  const back = <BackLink to="/admin/users">Usuarios</BackLink>;

  if (!parsed.success || hasCode(user.error, 'NOT_FOUND')) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={faUserSlash}
          title="Usuario no encontrado"
          message="La cuenta no existe."
        />
      </div>
    );
  }
  if (user.isPending) return <Spinner label="Cargando usuario..." />;
  if (user.isError) return <ErrorState error={user.error} onRetry={() => void user.refetch()} />;

  const { data } = user;
  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={data.name}
        subtitle={data.email}
        actions={<UserStatusControl user={data} />}
      />
      <Card>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm text-muted">Rol</dt>
            <dd className="mt-1">
              <RoleBadge role={data.role} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Estado</dt>
            <dd className="mt-1">
              <StatusBadge status={data.status} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Registro</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatDateTime(data.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Identificador</dt>
            <dd className="mt-1 text-sm text-slate-700">#{data.id}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
