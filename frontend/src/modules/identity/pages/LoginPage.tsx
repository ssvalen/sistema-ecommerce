import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginBodySchema, type LoginBody } from '@sistema-e/contracts';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { applyFieldErrors, notifyError } from '@/shared/http/errors';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/form';
import { AuthShell } from '../components/AuthShell';
import { IconInput, PasswordInput } from '../components/IconInput';
import { loginReason } from '../login-reason';
import { useLogin } from '../session';

// RequireGuest redirige tras el login.
export function LoginPage() {
  const location = useLocation();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginBody>({
    resolver: zodResolver(LoginBodySchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((body) =>
    login.mutate(body, {
      onError: (error) => {
        if (!applyFieldErrors(error, setError, ['email', 'password'])) notifyError(error);
      },
    }),
  );

  return (
    <AuthShell
      title="Bienvenido"
      subtitle={loginReason(location.state, 'login') ?? 'Ingresa tus credenciales para continuar.'}
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link
            to="/register"
            state={location.state as unknown}
            className="font-semibold text-blue-700 hover:underline"
          >
            Regístrate
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-5">
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
        <FormField label="Contraseña" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Tu contraseña"
            icon={faLock}
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <Button type="submit" fullWidth loading={login.isPending}>
          {login.isPending ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>
    </AuthShell>
  );
}
