import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AccountRole } from '../account/account-role.enum';
import { AuthenticatedAccount } from '../auth/auth.types';
import { Todo } from './models/todos.schema';
import { TodosService } from './todos.service';

describe('TodosService', () => {
  let service: TodosService;
  let todoModel: {
    find: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };
  const user: AuthenticatedAccount = {
    id: '507f1f77bcf86cd799439011',
    sub: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    role: AccountRole.USER,
    jti: 'token-id',
    exp: 2000000000,
  };

  beforeEach(async () => {
    todoModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: getModelToken(Todo.name), useValue: todoModel },
      ],
    }).compile();

    service = module.get<TodosService>(TodosService);
  });

  it('returns only the logged-in user’s todos', async () => {
    const todos = [{ title: 'Test', owner: user.sub }];
    todoModel.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue(todos),
    });

    await expect(service.getAll(user)).resolves.toEqual(todos);
    expect(todoModel.find).toHaveBeenCalledWith({ owner: user.sub });
  });

  it('returns every todo for an administrator', async () => {
    const todos = [{ title: 'Test' }];
    const admin = { ...user, role: AccountRole.ADMIN };
    todoModel.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue(todos),
    });

    await expect(service.getAll(admin)).resolves.toEqual(todos);
    expect(todoModel.find).toHaveBeenCalledWith();
  });

  it('sets the owner from the authenticated account', async () => {
    const todo = { title: 'Test', done: false, owner: user.sub };
    todoModel.create.mockResolvedValue(todo);

    await expect(
      service.create({ title: 'Test', done: false }, user),
    ).resolves.toEqual(todo);
    expect(todoModel.create).toHaveBeenCalledWith({
      title: 'Test',
      done: false,
      owner: user.sub,
    });
  });

  it('forbids a user from reading another user’s todo', async () => {
    const otherTodo = { title: 'Private', owner: '507f191e810c19729de860ea' };
    todoModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(otherTodo),
    });

    await expect(
      service.getOne('507f1f77bcf86cd799439012', user),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it('allows an administrator to read another user’s todo', async () => {
    const otherTodo = { title: 'Private', owner: '507f191e810c19729de860ea' };
    const admin = { ...user, role: AccountRole.ADMIN };
    todoModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(otherTodo),
    });

    await expect(
      service.getOne('507f1f77bcf86cd799439012', admin),
    ).resolves.toEqual(otherTodo);
  });

  it('returns 404 for a missing todo', async () => {
    todoModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.getOne('507f1f77bcf86cd799439012', user),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updates an owned todo with validation enabled', async () => {
    const existing = { title: 'Original', owner: user.sub };
    const updated = { title: 'Updated', done: true, owner: user.sub };
    todoModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });
    todoModel.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });

    await expect(
      service.update(
        '507f1f77bcf86cd799439012',
        { title: 'Updated', done: true },
        user,
      ),
    ).resolves.toEqual(updated);
    expect(todoModel.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      { title: 'Updated', done: true },
      { new: true, runValidators: true },
    );
  });

  it('deletes an owned todo', async () => {
    const existing = { title: 'Test', owner: user.sub };
    todoModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });
    todoModel.findByIdAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });

    await expect(
      service.delete('507f1f77bcf86cd799439012', user),
    ).resolves.toEqual({ message: 'Todo deleted' });
  });
});
