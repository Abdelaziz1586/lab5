import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TodoDocument = HydratedDocument<Todo>;

@Schema()
export class Todo {
  @Prop({ required: true, default: 'Untitled' })
  title: string;

  @Prop({ default: false })
  done: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true, index: true })
  owner: Types.ObjectId;
}

export const TodoSchema = SchemaFactory.createForClass(Todo);
