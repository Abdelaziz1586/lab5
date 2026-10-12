import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TodosService } from './todos.service';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccountRole } from '../account/account-role.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Controller('todos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(AccountRole.USER, AccountRole.ADMIN)
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  getAll(@Req() request: AuthenticatedRequest) {
    return this.todosService.getAll(request.user);
  }

  @Get(':id')
  getOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.todosService.getOne(id, request.user);
  }

  @Post()
  create(@Body() todo: CreateTodoDto, @Req() request: AuthenticatedRequest) {
    return this.todosService.create(todo, request.user);
  }

  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() todo: UpdateTodoDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.todosService.update(id, todo, request.user);
  }

  @Delete(':id')
  delete(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.todosService.delete(id, request.user);
  }
}
