import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

describe('TodosController', () => {
  it('can be constructed with its service dependency', () => {
    const controller = new TodosController({} as TodosService);

    expect(controller).toBeDefined();
  });
});
