import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { TokenRevocationService } from '../auth/token-revocation.service';
import { AccountRole } from './account-role.enum';
import { Account } from './models/account.schema';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let accountModel: { create: jest.Mock; findOne: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let tokenRevocationService: { revoke: jest.Mock };

  beforeEach(async () => {
    accountModel = { create: jest.fn(), findOne: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    tokenRevocationService = { revoke: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: getModelToken(Account.name), useValue: accountModel },
        { provide: JwtService, useValue: jwtService },
        {
          provide: TokenRevocationService,
          useValue: tokenRevocationService,
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it('hashes registration passwords and always assigns the user role', async () => {
    const password = await bcrypt.hash('correct horse battery staple', 4);
    const account = {
      _id: new Types.ObjectId(),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password,
      role: AccountRole.USER,
    };
    accountModel.create.mockResolvedValue(account);

    const result = await service.register({
      name: account.name,
      email: ' ADA@EXAMPLE.COM ',
      password: 'correct horse battery staple',
    });

    expect(accountModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: AccountRole.USER,
      }),
    );
    const savedPassword = accountModel.create.mock.calls[0][0].password;
    expect(savedPassword).not.toBe('correct horse battery staple');
    await expect(
      bcrypt.compare('correct horse battery staple', savedPassword),
    ).resolves.toBe(true);
    expect(result).not.toHaveProperty('password');
  });

  it('returns 409 when the unique email index rejects a duplicate', async () => {
    accountModel.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'correct horse battery staple',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the same login error when the account does not exist', async () => {
    accountModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      service.login({ email: 'missing@example.com', password: 'incorrect' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('signs an access token containing the account id, email, and role', async () => {
    const account = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'ada@example.com',
      password: await bcrypt.hash('correct horse battery staple', 4),
      role: AccountRole.ADMIN,
    };
    accountModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(account),
      }),
    });

    await expect(
      service.login({
        email: 'ada@example.com',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({ access_token: 'signed-token' });

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: account._id.toString(),
        sub: account._id.toString(),
        email: account.email,
        role: AccountRole.ADMIN,
      }),
    );
  });

  it('revokes the logged-in token until it expires', async () => {
    await expect(
      service.logout({
        id: '507f1f77bcf86cd799439011',
        sub: '507f1f77bcf86cd799439011',
        email: 'ada@example.com',
        role: AccountRole.USER,
        jti: 'token-id',
        exp: 2_000_000_000,
      }),
    ).resolves.toEqual({ message: 'Logged out successfully' });

    expect(tokenRevocationService.revoke).toHaveBeenCalledWith(
      'token-id',
      new Date(2_000_000_000_000),
    );
  });
});
