import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class StreamRunQueryDto {
  @ApiPropertyOptional({ description: 'Resume from this sequence number (exclusive).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  afterSeq?: number;

  @ApiPropertyOptional({ description: 'Include a snapshot frame before events.', default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSnapshot?: boolean;

  @ApiPropertyOptional({ description: 'Heartbeat interval in milliseconds.' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  heartbeatMs?: number;
}
