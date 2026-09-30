import type { Response } from 'express';
import type { PaginationMeta } from '@sistema-e/contracts';

export function sendData(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data });
}

export function sendPaginated(res: Response, items: unknown[], meta: PaginationMeta): void {
  res.status(200).json({ data: items, meta });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function paginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
