import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { runMetrics } from '../db/schema';

@Injectable()
export class MetricsRepository {
  constructor(private readonly database: DatabaseService) {}

  async get(runId: string) {
    const rows = await this.database.db.select().from(runMetrics).where(eq(runMetrics.runId, runId)).limit(1);
    return rows[0] ?? null;
  }

  async upsert(runId: string, patch: typeof runMetrics.$inferInsert) {
    await this.database.db
      .insert(runMetrics)
      .values({ ...patch, runId })
      .onConflictDoUpdate({
        target: runMetrics.runId,
        set: { ...patch, updatedAt: new Date().toISOString() }
      });
    return this.get(runId);
  }
}
