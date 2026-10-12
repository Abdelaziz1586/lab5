import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthGuard } from './auth.guard';
import {
  RevokedToken,
  RevokedTokenSchema,
} from './models/revoked-token.schema';
import { RolesGuard } from './roles.guard';
import { TokenRevocationService } from './token-revocation.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // This fallback keeps the starter usable locally. Set JWT_SECRET to a
        // strong random value anywhere the service is exposed beyond localhost.
        secret:
          config.get<string>('JWT_SECRET') ??
          'local-development-secret-change-before-deployment',
        signOptions: { expiresIn: '1h' },
      }),
    }),
    MongooseModule.forFeature([
      { name: RevokedToken.name, schema: RevokedTokenSchema },
    ]),
  ],
  providers: [AuthGuard, RolesGuard, TokenRevocationService],
  exports: [JwtModule, AuthGuard, RolesGuard, TokenRevocationService],
})
export class AuthModule {}
