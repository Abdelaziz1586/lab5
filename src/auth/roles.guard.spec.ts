import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountRole } from '../account/account-role.enum';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => jest.clearAllMocks());

  function contextFor(user?: { role: AccountRole }) {
    return {
      getHandler: () => 'handler',
      getClass: () => 'controller',
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any;
  }

  it('allows any role when no role metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextFor())).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      'handler',
      'controller',
    ]);
  });

  it('allows a role listed by the decorator', () => {
    reflector.getAllAndOverride.mockReturnValue([AccountRole.ADMIN]);

    expect(guard.canActivate(contextFor({ role: AccountRole.ADMIN }))).toBe(
      true,
    );
  });

  it('returns 403 when the account role is not allowed', () => {
    reflector.getAllAndOverride.mockReturnValue([AccountRole.ADMIN]);

    expect(() =>
      guard.canActivate(contextFor({ role: AccountRole.USER })),
    ).toThrow(ForbiddenException);
  });
});
