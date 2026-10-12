import { Request, Response, NextFunction } from 'express';

const MAX_DEPTH = 20;

/** Removes keys starting with `$` (Mongo operators) from nested objects/arrays, in place. */
const strip = (value: unknown, depth = 0): void => {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) strip(item, depth + 1);
    return;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith('$')) {
      delete (value as Record<string, unknown>)[key];
    } else {
      strip((value as Record<string, unknown>)[key], depth + 1);
    }
  }
};

/**
 * Prevents NoSQL operator injection such as `{ "token": { "$ne": null } }` reaching
 * Mongoose filters built directly from request input.
 */
export const stripMongoOperators = (req: Request, _res: Response, next: NextFunction): void => {
  strip(req.body);
  strip(req.query);
  strip(req.params);
  next();
};
