import type { Key, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { formatNumber } from '@/shared/lib/format';
import { Button } from './Button';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const last = Math.max(totalPages, 1);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted">
        Página {formatNumber(Math.min(page, last))} de {formatNumber(last)} · {formatNumber(total)}{' '}
        {total === 1 ? 'registro' : 'registros'}
      </span>
      <div className="flex gap-2">
        <Button
          color="gray"
          variant="soft"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button disabled={page >= last} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => Key;
  loading?: boolean;
  emptyMessage?: string;
  pagination?: PaginationProps;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = 'No hay datos disponibles.',
  pagination,
}: DataTableProps<T>) {
  const showSkeleton = loading && !rows;

  return (
    <div className="panel flex w-full flex-col overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-slate-700 tabular-nums">
          <thead className="bg-slate-800 text-white">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className={cx(
                    'border-b border-slate-700 px-4 py-3 text-left font-semibold whitespace-nowrap',
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cx(loading && rows && 'opacity-60 transition-opacity')}>
            {showSkeleton &&
              Array.from({ length: 5 }, (_, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.header} className="border-b border-slate-100 px-4 py-4">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))}
            {rows?.map((row) => (
              <tr key={rowKey(row)} className="transition hover:bg-blue-50/50">
                {columns.map((column) => (
                  <td
                    key={column.header}
                    className={cx('border-b border-slate-100 px-4 py-3', column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pagination && rows && rows.length > 0 && <Pagination {...pagination} />}
    </div>
  );
}
