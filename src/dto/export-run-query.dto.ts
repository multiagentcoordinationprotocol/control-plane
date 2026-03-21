import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ExportRunQueryDto {
  @ApiPropertyOptional({ description: 'Include canonical events in the export.', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCanonical?: boolean;

  @ApiPropertyOptional({ description: 'Include raw events in the export.', default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeRaw?: boolean;

  @ApiPropertyOptional({ description: 'Maximum number of events to include.', default: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50000)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  eventLimit?: number;

  @ApiPropertyOptional({ description: 'Export format: json or jsonl.', default: 'json', enum: ['json', 'jsonl'] })
  @IsOptional()
  @IsString()
  format?: 'json' | 'jsonl';
}
