import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState, type ComponentProps } from 'react';
import { cx } from '@/shared/lib/cx';
import { Input } from '@/shared/ui/form';

type IconInputProps = ComponentProps<typeof Input> & { icon: IconDefinition };

export function IconInput({ icon, className, ...props }: IconInputProps) {
  return (
    <div className="relative">
      <FontAwesomeIcon
        icon={icon}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-500"
      />
      <Input {...props} className={cx('pl-11', className)} />
    </div>
  );
}

export function PasswordInput({ icon, ...props }: IconInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <IconInput {...props} icon={icon} type={visible ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-500 hover:text-slate-700"
      >
        <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} />
      </button>
    </div>
  );
}
