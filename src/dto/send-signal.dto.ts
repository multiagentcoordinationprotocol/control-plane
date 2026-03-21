import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendSignalDto {
  @ApiProperty({ description: 'Sender participant ID' })
  @IsString()
  @IsNotEmpty()
  from!: string;

  @ApiProperty({ description: 'Target participant IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  to!: string[];

  @ApiProperty({ description: 'Signal message type (e.g., "Signal")' })
  @IsString()
  @IsNotEmpty()
  messageType!: string;

  @ApiPropertyOptional({ description: 'Signal payload' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Signal type classification (e.g., anomaly, alert)' })
  @IsOptional()
  @IsString()
  signalType?: string;

  @ApiPropertyOptional({ description: 'Signal severity (e.g., low, medium, high, critical)' })
  @IsOptional()
  @IsString()
  severity?: string;
}
