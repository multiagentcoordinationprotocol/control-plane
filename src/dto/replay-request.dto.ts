import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class ReplayRequestDto {
  @ApiPropertyOptional({ enum: ['instant', 'timed', 'step'], default: 'timed' })
  @IsOptional()
  @IsIn(['instant', 'timed', 'step'])
  mode?: 'instant' | 'timed' | 'step';

  @ApiPropertyOptional({ description: 'Playback speed multiplier for timed replay.', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  speed?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  fromSeq?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  toSeq?: number;
}
