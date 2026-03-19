import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { RunStateProjection } from '../contracts/control-plane';
import { DatabaseService } from '../db/database.service';
import { runProjections } from '../db/schema';

@Injectable()
export class ProjectionRepository {
  constructor(private readonly database: DatabaseService) {}

  async get(runId: string) {
    const rows = await this.database.db
      .select()
      .from(runProjections)
      .where(eq(runProjections.runId, runId))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(runId: string, projection: RunStateProjection, version: number) {
    await this.database.db
      .insert(runProjections)
      .values({
        runId,
        version,
        runSummary: projection.run as unknown as Record<string, unknown>,
        participants: projection.participants as unknown as Record<string, unknown>[],
        graph: projection.graph as unknown as Record<string, unknown>,
        decision: projection.decision as unknown as Record<string, unknown>,
        signals: projection.signals as unknown as Record<string, unknown>,
        timeline: projection.timeline as unknown as Record<string, unknown>,
        traceSummary: projection.trace as unknown as Record<string, unknown>,
        updatedAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: runProjections.runId,
        set: {
          version,
          runSummary: projection.run as unknown as Record<string, unknown>,
          participants: projection.participants as unknown as Record<string, unknown>[],
          graph: projection.graph as unknown as Record<string, unknown>,
          decision: projection.decision as unknown as Record<string, unknown>,
          signals: projection.signals as unknown as Record<string, unknown>,
          timeline: projection.timeline as unknown as Record<string, unknown>,
          traceSummary: projection.trace as unknown as Record<string, unknown>,
          updatedAt: new Date().toISOString()
        }
      });
  }
}
