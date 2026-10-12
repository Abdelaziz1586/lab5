import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { AuthenticatedRequest } from './auth.types';
import { TokenRevocationService } from './token-revocation.service';

describe('AuthGuard', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const tokenRevocationService = { isRevoked: jest.fn() };
  const guard = new AuthGuard(
    jwtService as unknown as JwtService,
    tokenRevocationService as unknown as TokenRevocationService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function contextFor(request: Partial<AuthenticatedRequest>) {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  }

  it('rejects a missing bearer token', async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects tokens invalidated by logout', async () => {
    const payload = {
      id: '507f1f77bcf86cd799439011',
      sub: '507f1f77bcf86cd799439011',
      email: 'ada@example.com',
      role: 'user',
      jti: 'token-id',
      exp: 2_000_000_000,
    };
    const request = {
      headers: { authorization: 'Bearer signed-token' },
    } as Partial<AuthenticatedRequest>;
    jwtService.verifyAsync.mockResolvedValue(payload);
    tokenRevocationService.isRevoked.mockResolvedValue(true);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request).not.toHaveProperty('user');
  });

  it('attaches a valid account payload to the request', async () => {
    const payload = {
      id: '507f1f77bcf86cd799439011',
      sub: '507f1f77bcf86cd799439011',
      email: 'ada@example.com',
      role: 'user',
      jti: 'token-id',
      exp: 2_000_000_000,
    };
    const request = {
      headers: { authorization: 'Bearer signed-token' },
    } as Partial<AuthenticatedRequest>;
    jwtService.verifyAsync.mockResolvedValue(payload);
    tokenRevocationService.isRevoked.mockResolvedValue(false);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });
});
