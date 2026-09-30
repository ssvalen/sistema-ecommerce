import { faEnvelope, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterBodySchema, type RegisterBody } from '@sistema-e/contracts';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { applyFieldErrors, hasCode, notifyError } from '@/shared/http/errors';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/form';
import { AuthShell } from '../components/AuthShell';
import { IconInput, PasswordInput } from '../components/IconInput';
import { loginReason } from '../login-reason';
import { useRegister } from '../session';

export function RegisterPage() {
  const location = useLocation();
  const registration = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterBody>({
    resolver: zodResolver(RegisterBodySchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit((body) =>
    registration.mutate(body, {
      onError: (error) => {
        if (hasCode(error, 'EMAIL_TAKEN')) {
          setError('email', { type: 'server', message: error.message });
        } else if (!applyFieldErrors(error, setError, ['name', 'email', 'password'])) {
          notifyError(error);
        }
      },
    }),
  );

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle={loginReason(location.state, 'register') ?? 'Regístrate para comprar en la tienda.'}
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            state={location.state as unknown}
            className="font-semibold text-blue-700 hover:underline"
          >
            Inicia sesión
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-5">
        <FormField label="Nombre" htmlFor="name" error={errors.name?.message}>
          <IconInput
            id="name"
            autoComplete="name"
            placeholder="Tu nombre"
            icon={faUser}
            invalid={!!errors.name}
            {...register('name')}
          />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <IconInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            icon={faEnvelope}
            invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>
        <FormField
          label="Contraseña"
          htmlFor="password"
          error={errors.password?.message}
          hint="Mínimo 8 caracteres."
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Crea una contraseña"
            icon={faLock}
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <Button type="submit" fullWidth loading={registration.isPending}>
          {registration.isPending ? 'Creando cuenta...' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthShell>
  );
}
