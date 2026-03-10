import { Request, Response, NextFunction } from 'express';

export const checkCredit = (cost: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Placeholder for credit check middleware
    next();
  };
};
