import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gt, lt, sql, SQL } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../db/database.service';
import { auditLog } from '../db/schema';

export interface AuditEntry {
  actor: string;
  actorType: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly database: DatabaseService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.database.db.insert(auditLog).values({
        id: randomUUID(),
        actor: entry.actor,
        actorType: entry.actorType,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details ?? {},
        requestId: entry.requestId,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      // Audit failures should not break the main flow
      this.logger.error(`audit record failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async list(filters: {
    actor?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    createdAfter?: string;
    createdBefore?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: (typeof auditLog.$inferSelect)[]; total: number }> {
    const conditions: SQL[] = [];
    if (filters.actor) conditions.push(eq(auditLog.actor, filters.actor));
    if (filters.action) conditions.push(eq(auditLog.action, filters.action));
    if (filters.resource) conditions.push(eq(auditLog.resource, filters.resource));
    if (filters.resourceId) conditions.push(eq(auditLog.resourceId, filters.resourceId));
    if (filters.createdAfter) conditions.push(gt(auditLog.createdAt, filters.createdAfter));
    if (filters.createdBefore) conditions.push(lt(auditLog.createdAt, filters.createdBefore));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      this.database.db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0),
      this.database.db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where)
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }
}
