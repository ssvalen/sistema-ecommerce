import { faBagShopping } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router';
import { cx } from '@/shared/lib/cx';

interface LogoProps {
  subtitle: string;
  dark?: boolean;
  onClick?: () => void;
}

export function Logo({ subtitle, dark = false, onClick }: LogoProps) {
  return (
    <Link to="/" onClick={onClick} className="flex shrink-0 items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent shadow-sm md:h-11 md:w-11">
        <FontAwesomeIcon icon={faBagShopping} className="text-lg text-white md:text-xl" />
      </div>
      <div className="hidden sm:block">
        <p className={cx('text-lg leading-none font-bold', dark ? 'text-white' : 'text-slate-900')}>
          Sistema E
        </p>
        <p className={cx('mt-1 text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{subtitle}</p>
      </div>
    </Link>
  );
}
