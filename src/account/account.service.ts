import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { AuthenticatedAccount } from '../auth/auth.types';
import { TokenRevocationService } from '../auth/token-revocation.service';
import { AccountRole } from './account-role.enum';
import { Account } from './models/account.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
    private readonly jwtService: JwtService,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const password = await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS);

    try {
      const account = await this.accountModel.create({
        name: registerDto.name.trim(),
        email,
        password,
        role: AccountRole.USER,
      });
      const { _id, name, createdAt, updatedAt } = account;
      return {
        _id,
        name,
        email: account.email,
        role: account.role,
        createdAt,
        updatedAt,
      };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const account = await this.accountModel
      .findOne({ email: loginDto.email.trim().toLowerCase() })
      .select('+password')
      .exec();

    const passwordMatches = account
      ? await bcrypt.compare(loginDto.password, account.password)
      : false;

    if (!account || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accountId = account._id.toString();
    const access_token = await this.jwtService.signAsync({
      id: accountId,
      sub: accountId,
      email: account.email,
      role: account.role,
      jti: randomUUID(),
    });

    return { access_token };
  }

  async logout(user: AuthenticatedAccount): Promise<{ message: string }> {
    await this.tokenRevocationService.revoke(
      user.jti,
      new Date(user.exp * 1000),
    );
    return { message: 'Logged out successfully' };
  }
}
