import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../db/database.service';
import { runOutboundMessages } from '../db/schema';

export interface NewOutboundMessage {
  runId: string;
  runtimeSessionId: string;
  messageId: string;
  messageType: string;
  category: 'kickoff' | 'signal' | 'context_update';
  sender: string;
  recipients: string[];
  payloadDescriptor?: Record<string, unknown>;
}

@Injectable()
export class OutboundMessageRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: NewOutboundMessage) {
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.db.insert(runOutboundMessages).values({
      id,
      runId: input.runId,
      runtimeSessionId: input.runtimeSessionId,
      messageId: input.messageId,
      messageType: input.messageType,
      category: input.category,
      sender: input.sender,
      recipients: input.recipients,
      status: 'queued',
      payloadDescriptor: input.payloadDescriptor ?? {},
      createdAt: now,
      updatedAt: now
    });
    return this.findByMessageId(input.messageId);
  }

  async markAccepted(messageId: string, ack: Record<string, unknown>) {
    const now = new Date().toISOString();
    await this.database.db
      .update(runOutboundMessages)
      .set({ status: 'accepted', ack, acceptedAt: now, updatedAt: now })
      .where(eq(runOutboundMessages.messageId, messageId));
  }

  async markRejected(messageId: string, errorMessage: string, ack?: Record<string, unknown>) {
    const now = new Date().toISOString();
    await this.database.db
      .update(runOutboundMessages)
      .set({ status: 'rejected', ack, errorMessage, updatedAt: now })
      .where(eq(runOutboundMessages.messageId, messageId));
  }

  async findByMessageId(messageId: string) {
    const rows = await this.database.db
      .select()
      .from(runOutboundMessages)
      .where(eq(runOutboundMessages.messageId, messageId))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByRunId(runId: string) {
    return this.database.db
      .select()
      .from(runOutboundMessages)
      .where(eq(runOutboundMessages.runId, runId))
      .orderBy(asc(runOutboundMessages.createdAt));
  }

  async listByRunIdAndStatus(runId: string, status: string) {
    return this.database.db
      .select()
      .from(runOutboundMessages)
      .where(and(eq(runOutboundMessages.runId, runId), eq(runOutboundMessages.status, status)))
      .orderBy(asc(runOutboundMessages.createdAt));
  }
}
