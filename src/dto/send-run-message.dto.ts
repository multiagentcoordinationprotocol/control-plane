import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PayloadEnvelopeDto } from './execution-request.dto';

export class SendRunMessageDto {
  @ApiProperty({ description: 'Sender participant ID.' })
  @IsString()
  @IsNotEmpty()
  from!: string;

  @ApiPropertyOptional({ type: [String], description: 'Recipient participant IDs. Omit for broadcast.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  to?: string[];

  @ApiProperty({ description: 'Exact MACP message type (e.g. "Evaluation", "Vote", "TaskRequest").' })
  @IsString()
  @IsNotEmpty()
  messageType!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Convenience JSON payload.' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => PayloadEnvelopeDto, description: 'Binary/proto payload override.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayloadEnvelopeDto)
  payloadEnvelope?: PayloadEnvelopeDto;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Optional message metadata.' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
