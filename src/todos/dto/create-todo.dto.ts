import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTodoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
