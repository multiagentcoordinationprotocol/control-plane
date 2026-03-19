import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateArtifactDto {
  @ApiProperty({ enum: ['trace', 'json', 'report', 'log', 'bundle'] })
  @IsIn(['trace', 'json', 'report', 'log', 'bundle'])
  kind!: 'trace' | 'json' | 'report' | 'log' | 'bundle';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uri?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  inline?: Record<string, unknown>;
}
