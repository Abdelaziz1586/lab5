import { Request } from 'express';
import { AccountRole } from '../account/account-role.enum';

export interface AuthenticatedAccount {
  id: string;
  sub: string;
  email: string;
  role: AccountRole;
  jti: string;
  exp: number;
  iat?: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedAccount;
}
