import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faCreditCard,
  faFire,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

const HIGHLIGHTS: { icon: IconDefinition; text: string }[] = [
  { icon: faFire, text: 'El ranking de los más vendidos, siempre a la vista.' },
  { icon: faMagnifyingGlass, text: 'Busca y filtra por categoría o precio.' },
  { icon: faCreditCard, text: 'Crea tu pedido desde el carrito y confirma el pago.' },
];

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen">
      <div
        data-surface="dark"
        className="hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white lg:flex lg:w-1/2"
      >
        <div className="mx-auto flex max-w-lg flex-col justify-center px-12">
          <p className="text-5xl leading-tight font-bold">Sistema E</p>
          <p className="mt-4 text-lg leading-relaxed text-blue-50">
            Tu tienda en línea: catálogo, carrito y pedidos en un solo lugar.
          </p>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <FontAwesomeIcon icon={icon} className="w-5 text-cyan-200" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-blue-700"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver a la tienda
          </Link>
          <div className="panel p-8 shadow-xl">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-balance text-slate-900">{title}</h1>
              <p className="mt-2 text-pretty text-slate-600">{subtitle}</p>
            </div>
            {children}
            <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
              {footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
