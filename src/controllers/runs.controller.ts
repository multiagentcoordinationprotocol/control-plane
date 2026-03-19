import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  ValidationPipe
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from '@nestjs/swagger';
import { concat, from, map, Observable } from 'rxjs';
import { ReplayRequest, RunStatus } from '../contracts/control-plane';
import { ExecutionRequestDto } from '../dto/execution-request.dto';
import { ListEventsQueryDto } from '../dto/list-events-query.dto';
import { ListRunsQueryDto } from '../dto/list-runs-query.dto';
import { ReplayRequestDto } from '../dto/replay-request.dto';
import {
  CanonicalEventDto,
  CreateRunResponseDto,
  ReplayDescriptorDto,
  RunStateResponseDto
} from '../dto/run-responses.dto';
import { StreamHubService } from '../events/stream-hub.service';
import { ReplayService } from '../replay/replay.service';
import { EventRepository } from '../storage/event.repository';
import { RunExecutorService } from '../runs/run-executor.service';
import { RunManagerService } from '../runs/run-manager.service';

@ApiTags('runs')
@Controller('runs')
export class RunsController {
  constructor(
    private readonly runExecutor: RunExecutorService,
    private readonly runManager: RunManagerService,
    private readonly eventRepository: EventRepository,
    private readonly replayService: ReplayService,
    private readonly streamHub: StreamHubService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List runs with optional filtering and pagination.' })
  async listRuns(
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: ListRunsQueryDto
  ) {
    return this.runManager.listRuns({
      status: query.status,
      tags: query.tags,
      createdAfter: query.createdAfter,
      createdBefore: query.createdBefore,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc'
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create and launch a runtime execution run.' })
  @ApiAcceptedResponse({ type: CreateRunResponseDto })
  @ApiBody({ type: ExecutionRequestDto })
  async createRun(@Body(new ValidationPipe({ transform: true, whitelist: true })) body: ExecutionRequestDto) {
    const run = await this.runExecutor.launch(body);
    return {
      runId: run.id,
      status: run.status as RunStatus,
      traceId: run.traceId ?? undefined
    } satisfies CreateRunResponseDto;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch the run record.' })
  async getRun(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.runManager.getRun(id);
  }

  @Get(':id/state')
  @ApiOperation({ summary: 'Fetch the projected run state for UI rendering.' })
  @ApiOkResponse({ type: RunStateResponseDto })
  async getRunState(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.runManager.getState(id);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List canonical events for a run.' })
  @ApiQuery({ name: 'afterSeq', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: [CanonicalEventDto] })
  async getRunEvents(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: ListEventsQueryDto
  ) {
    return this.eventRepository.listCanonicalByRun(id, query.afterSeq ?? 0, query.limit ?? 200);
  }

  @Sse(':id/stream')
  @ApiOperation({ summary: 'Subscribe to normalized live run events over SSE.' })
  streamRun(@Param('id', new ParseUUIDPipe()) id: string): Observable<MessageEvent> {
    const initial$ = from(this.runManager.getState(id)).pipe(
      map((state) => ({ type: 'snapshot', data: state }) as MessageEvent)
    );
    const live$ = this.streamHub.stream(id).pipe(
      map((item) => ({ type: item.event, data: item.data }) as MessageEvent)
    );
    return concat(initial$, live$);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a running session in the runtime.' })
  async cancelRun(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: { reason?: string }
  ) {
    return this.runExecutor.cancel(id, body?.reason);
  }

  @Post(':id/replay')
  @ApiOperation({ summary: 'Create a replay descriptor for a prior run.' })
  @ApiAcceptedResponse({ type: ReplayDescriptorDto })
  async createReplay(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: ReplayRequestDto
  ) {
    const replay: ReplayRequest = {
      mode: body.mode ?? 'timed',
      speed: body.speed ?? 1,
      fromSeq: body.fromSeq,
      toSeq: body.toSeq
    };
    return this.replayService.describe(id, replay);
  }

  @Sse(':id/replay/stream')
  @ApiOperation({ summary: 'Replay a run using persisted canonical events.' })
  streamReplay(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: ReplayRequestDto
  ): Observable<MessageEvent> {
    return this.replayService
      .stream(id, {
        mode: query.mode ?? 'timed',
        speed: query.speed ?? 1,
        fromSeq: query.fromSeq,
        toSeq: query.toSeq
      })
      .pipe(map((item) => ({ type: item.type, data: item.data }) as MessageEvent));
  }

  @Get(':id/replay/state')
  @ApiOperation({ summary: 'Project run state at a specific event sequence for scrubber/replay UIs.' })
  async getReplayState(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('seq') seq?: string
  ) {
    return this.replayService.stateAt(id, seq ? Number(seq) : undefined);
  }
}
