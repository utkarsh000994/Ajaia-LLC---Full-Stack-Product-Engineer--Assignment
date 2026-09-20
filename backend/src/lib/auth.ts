import type { NextFunction, Request, Response } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  next();
}

export function getCurrentUserId(req: Request) {
  return req.session?.userId ?? null;
}
