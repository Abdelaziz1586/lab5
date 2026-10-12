import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RevokedToken } from './models/revoked-token.schema';

@Injectable()
export class TokenRevocationService {
  constructor(
    @InjectModel(RevokedToken.name)
    private readonly revokedTokenModel: Model<RevokedToken>,
  ) {}

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    await this.revokedTokenModel
      .updateOne(
        { jti },
        { $setOnInsert: { jti, expiresAt } },
        { upsert: true },
      )
      .exec();
  }

  async isRevoked(jti: string): Promise<boolean> {
    const revokedToken = await this.revokedTokenModel
      .findOne({ jti })
      .select('_id')
      .lean()
      .exec();
    return revokedToken !== null;
  }
}
