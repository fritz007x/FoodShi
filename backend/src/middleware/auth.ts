import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db';
import { AppError } from './errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  walletAddress?: string;
  name?: string;
  isVerifiedDonor: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };

    const user = await queryOne<{
      id: string;
      email: string;
      wallet_address: string;
      name: string;
      is_verified_donor: boolean;
    }>(
      'SELECT id, email, wallet_address, name, is_verified_donor FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user) {
      throw new AppError('User not found', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      walletAddress: user.wallet_address,
      name: user.name,
      isVerifiedDonor: user.is_verified_donor,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  authenticate(req, res, next);
}
