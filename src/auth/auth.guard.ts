import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedAccount, AuthenticatedRequest } from './auth.types';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const parts = request.headers?.authorization?.trim().split(/\s+/) ?? [];
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    let payload: AuthenticatedAccount;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedAccount>(
        parts[1],
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (
      !payload.sub ||
      !payload.email ||
      !payload.role ||
      !payload.jti ||
      !payload.exp ||
      (payload.role !== 'user' && payload.role !== 'admin')
    ) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (await this.tokenRevocationService.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = payload;
    return true;
  }
}
