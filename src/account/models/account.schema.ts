import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AccountRole } from '../account-role.enum';

export type AccountDocument = HydratedDocument<Account>;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_document, result) => {
      delete (result as Record<string, unknown>).password;
      return result;
    },
  },
  toObject: {
    transform: (_document, result) => {
      delete (result as Record<string, unknown>).password;
      return result;
    },
  },
})
export class Account {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    required: true,
    enum: Object.values(AccountRole),
    default: AccountRole.USER,
  })
  role: AccountRole;

  createdAt: Date;
  updatedAt: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
