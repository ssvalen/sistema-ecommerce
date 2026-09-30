import { faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons';
import type { User } from '@sistema-e/contracts';
import { useState } from 'react';
import { notifyError } from '@/shared/http/errors';
import { Button } from '@/shared/ui/Button';
import { ConfirmationModal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast';
import { useSession } from '../session';
import { useSetUserStatus } from '../users';

// Un admin no puede bloquearse a sí mismo.
export function UserStatusControl({ user }: { user: User }) {
  const { user: currentUser } = useSession();
  const setStatus = useSetUserStatus();
  const [confirming, setConfirming] = useState(false);

  if (user.id === currentUser?.id) return null;
  const blocking = user.status === 'ACTIVE';

  const confirm = () =>
    setStatus.mutate(
      { id: user.id, status: blocking ? 'BLOCKED' : 'ACTIVE' },
      {
        onSuccess: (updated) => {
          toast.success(
            updated.status === 'BLOCKED'
              ? `Se bloqueó la cuenta de ${updated.name}.`
              : `Se desbloqueó la cuenta de ${updated.name}.`,
          );
          setConfirming(false);
        },
        onError: notifyError,
      },
    );

  return (
    <>
      <Button
        size="sm"
        color={blocking ? 'red' : 'green'}
        variant="soft"
        icon={blocking ? faLock : faLockOpen}
        onClick={() => setConfirming(true)}
      >
        {blocking ? 'Bloquear' : 'Desbloquear'}
      </Button>
      <ConfirmationModal
        open={confirming}
        title={blocking ? 'Bloquear cuenta' : 'Desbloquear cuenta'}
        message={
          blocking
            ? `${user.name} no podrá iniciar sesión ni usar funciones protegidas hasta que desbloquees su cuenta.`
            : `${user.name} podrá volver a iniciar sesión.`
        }
        confirmText={blocking ? 'Bloquear' : 'Desbloquear'}
        confirmColor={blocking ? 'red' : 'green'}
        loading={setStatus.isPending}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
