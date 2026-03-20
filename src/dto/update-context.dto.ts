import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class UpdateContextDto {
  @ApiProperty({ description: 'Sender participant ID' })
  @IsString()
  @IsNotEmpty()
  from!: string;

  @ApiProperty({ description: 'Context payload to send to the runtime session' })
  @IsObject()
  context!: Record<string, unknown>;
}
