import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ValidationPipe
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompareRunsDto } from '../dto/compare-runs.dto';
import { ExportRunQueryDto } from '../dto/export-run-query.dto';
import { RunBundleExportDto, RunComparisonResultDto } from '../dto/run-responses.dto';
import { RunInsightsService } from '../insights/run-insights.service';

@ApiTags('runs')
@Controller('runs')
export class RunInsightsController {
  constructor(private readonly insightsService: RunInsightsService) {}

  @Get(':id/export')
  @ApiOperation({ summary: 'Export a full run bundle (run, session, projection, events, artifacts).' })
  @ApiOkResponse({ type: RunBundleExportDto })
  async exportRun(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: ExportRunQueryDto
  ) {
    return this.insightsService.exportRun(id, {
      includeCanonical: query.includeCanonical,
      includeRaw: query.includeRaw,
      eventLimit: query.eventLimit
    });
  }

  @Post('compare')
  @ApiOperation({ summary: 'Compare two runs side-by-side.' })
  @ApiBody({ type: CompareRunsDto })
  @ApiOkResponse({ type: RunComparisonResultDto })
  async compareRuns(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: CompareRunsDto
  ) {
    return this.insightsService.compareRuns(body.leftRunId, body.rightRunId);
  }
}
