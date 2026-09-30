import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '@/shared/lib/cx';

export type ButtonColor = 'blue' | 'green' | 'red' | 'gray';
export type ButtonVariant = 'solid' | 'soft' | 'outline' | 'gradient';
type ButtonSize = 'md' | 'sm';

// Solo para «Continuar al pago» y «Pagar».
const GRADIENT =
  'border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg';

const COLORS: Record<ButtonColor, Record<Exclude<ButtonVariant, 'gradient'>, string>> = {
  blue: {
    solid: 'border border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700',
    soft: 'border border-blue-100 bg-blue-50/80 text-blue-700 hover:bg-blue-100',
    outline: 'border border-blue-200 bg-white text-blue-700 hover:bg-blue-50',
  },
  green: {
    solid: 'border border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800',
    soft: 'border border-emerald-100 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100',
    outline: 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
  },
  red: {
    solid: 'border border-rose-700 bg-rose-700 text-white shadow-sm hover:bg-rose-800',
    soft: 'border border-rose-100 bg-rose-50/80 text-rose-700 hover:bg-rose-100',
    outline: 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
  },
  gray: {
    solid: 'border border-slate-700 bg-slate-700 text-white shadow-sm hover:bg-slate-800',
    soft: 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  },
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-5 py-2.5',
  sm: 'min-h-9 px-3 py-1.5 pointer-coarse:min-h-11',
};

interface StyleProps {
  color?: ButtonColor;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

function buttonClasses({
  color = 'blue',
  variant = 'solid',
  size = 'md',
  fullWidth = false,
  className,
}: StyleProps): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
    SIZES[size],
    variant === 'gradient' ? GRADIENT : COLORS[color][variant],
    fullWidth && 'w-full',
    className,
  );
}

function Content({
  icon,
  loading,
  children,
}: {
  icon?: IconDefinition;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : (
        icon && <FontAwesomeIcon icon={icon} className="text-sm" />
      )}
      {children !== undefined && <span className="whitespace-nowrap">{children}</span>}
    </>
  );
}

type ButtonProps = StyleProps &
  Omit<ComponentProps<'button'>, 'color'> & {
    icon?: IconDefinition;
    loading?: boolean;
  };

export function Button({
  color,
  variant,
  size,
  fullWidth,
  className,
  icon,
  loading = false,
  disabled,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ color, variant, size, fullWidth, className })}
    >
      <Content icon={icon} loading={loading}>
        {children}
      </Content>
    </button>
  );
}

type ButtonLinkProps = StyleProps &
  Omit<LinkProps, 'color' | 'className'> & { icon?: IconDefinition };

export function ButtonLink({
  color,
  variant,
  size,
  fullWidth,
  className,
  icon,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={buttonClasses({ color, variant, size, fullWidth, className })}>
      <Content icon={icon}>{children}</Content>
    </Link>
  );
}
