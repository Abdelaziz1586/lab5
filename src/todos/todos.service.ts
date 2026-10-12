import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Todo } from './models/todos.schema';
import { AccountRole } from '../account/account-role.enum';
import { AuthenticatedAccount } from '../auth/auth.types';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodosService {
  constructor(
    @InjectModel(Todo.name) private readonly todoModel: Model<Todo>,
  ) {}

  getAll(user: AuthenticatedAccount) {
    return user.role === AccountRole.ADMIN
      ? this.todoModel.find().exec()
      : this.todoModel.find({ owner: user.sub }).exec();
  }

  async getOne(id: string, user: AuthenticatedAccount) {
    const todo = await this.todoModel.findById(id).exec();
    this.ensureTodoExists(todo);
    this.ensureCanAccess(todo, user);
    return todo;
  }

  create(todo: CreateTodoDto, user: AuthenticatedAccount) {
    return this.todoModel.create({ ...todo, owner: user.sub });
  }

  async update(
    id: string,
    updatedTodo: UpdateTodoDto,
    user: AuthenticatedAccount,
  ) {
    const existingTodo = await this.todoModel.findById(id).exec();
    this.ensureTodoExists(existingTodo);
    this.ensureCanAccess(existingTodo, user);

    const updated = await this.todoModel
      .findByIdAndUpdate(id, updatedTodo, { new: true, runValidators: true })
      .exec();
    this.ensureTodoExists(updated);
    return updated;
  }

  async delete(id: string, user: AuthenticatedAccount) {
    const existingTodo = await this.todoModel.findById(id).exec();
    this.ensureTodoExists(existingTodo);
    this.ensureCanAccess(existingTodo, user);

    const todo = await this.todoModel.findByIdAndDelete(id).exec();
    this.ensureTodoExists(todo);
    return { message: todo ? 'Todo deleted' : 'Todo not found' };
  }

  private ensureTodoExists(todo: Todo | null): asserts todo is Todo {
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }
  }

  private ensureCanAccess(todo: Todo, user: AuthenticatedAccount): void {
    if (user.role !== AccountRole.ADMIN && String(todo.owner) !== user.sub) {
      throw new ForbiddenException('You do not have access to this todo');
    }
  }
}
