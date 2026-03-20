import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CompareRunsDto {
  @ApiProperty({ description: 'UUID of the left run to compare.' })
  @IsUUID()
  leftRunId!: string;

  @ApiProperty({ description: 'UUID of the right run to compare.' })
  @IsUUID()
  rightRunId!: string;
}
