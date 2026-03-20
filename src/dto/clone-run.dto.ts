import { IsOptional, IsArray, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CloneRunDto {
  @ApiPropertyOptional({ description: 'Override tags for the cloned run' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Override context for the cloned run' })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
