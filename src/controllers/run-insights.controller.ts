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
import { RunExecutorService } from '../runs/run-executor.service';

@ApiTags('runs')
@Controller('runs')
export class RunInsightsController {
  constructor(
    private readonly insightsService: RunInsightsService,
    private readonly runExecutor: RunExecutorService
  ) {}

  @Get(':id/export')
  @ApiOperation({ summary: 'Export a full run bundle (run, session, projection, events, artifacts).' })
  @ApiOkResponse({ type: RunBundleExportDto })
  async exportRun(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: ExportRunQueryDto
  ) {
    if (query.format === 'jsonl') {
      const jsonl = await this.insightsService.exportRunJsonl(id, {
        includeCanonical: query.includeCanonical,
        includeRaw: query.includeRaw,
        eventLimit: query.eventLimit
      });
      return jsonl;
    }
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

  @Post('batch/cancel')
  @ApiOperation({ summary: 'Cancel multiple runs in batch.' })
  async batchCancel(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: { runIds: string[] }
  ) {
    const results = await Promise.allSettled(
      body.runIds.map((id) => this.runExecutor.cancel(id, 'batch cancel'))
    );
    return results.map((result, index) => ({
      runId: body.runIds[index],
      status: result.status === 'fulfilled' ? 'cancelled' : 'failed',
      error: result.status === 'rejected' ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : undefined
    }));
  }

  @Post('batch/export')
  @ApiOperation({ summary: 'Export multiple runs in batch.' })
  async batchExport(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: { runIds: string[] }
  ) {
    return Promise.all(
      body.runIds.map((id) => this.insightsService.exportRun(id, { includeCanonical: true, includeRaw: false }))
    );
  }
}
