import { Injectable, Logger } from '@nestjs/common';
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
}
