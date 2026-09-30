import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { ValidationError, type ValidationIssue } from '../errors/app-error.js';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

type Output<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface HandlerInput<S extends Schemas> {
  body: Output<S['body']>;
  query: Output<S['query']>;
  params: Output<S['params']>;
}

// Valida body, query y params con Zod y ejecuta fn con los datos tipados.
export function handler<S extends Schemas>(
  schemas: S,
  fn: (input: HandlerInput<S>, req: Request, res: Response) => Promise<void> | void,
): RequestHandler {
  return async (req, res) => {
    const issues: ValidationIssue[] = [];

    const parse = (
      schema: z.ZodType | undefined,
      value: unknown,
      location: ValidationIssue['location'],
    ): unknown => {
      if (!schema) return undefined;
      const result = schema.safeParse(value);
      if (result.success) return result.data;
      for (const issue of result.error.issues) {
        issues.push({ location, path: issue.path.map(String).join('.'), message: issue.message });
      }
      return undefined;
    };

    const input = {
      body: parse(schemas.body, req.body, 'body'),
      query: parse(schemas.query, req.query, 'query'),
      params: parse(schemas.params, req.params, 'params'),
    };
    if (issues.length > 0) throw new ValidationError(issues);

    await fn(input as HandlerInput<S>, req, res);
  };
}
