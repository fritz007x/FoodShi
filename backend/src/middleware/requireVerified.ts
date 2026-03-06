import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/index';

/**
 * Middleware that requires the authenticated user to be World ID verified.
 * Must be used after `verifyJWT`.
 */
export async function requireVerified(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await queryOne<{ is_verified_donor: boolean }>(
    'SELECT is_verified_donor FROM users WHERE id = $1',
    [userId]
  );

  if (!user?.is_verified_donor) {
    res.status(403).json({ error: 'World ID verification required' });
    return;
  }

  next();
}
