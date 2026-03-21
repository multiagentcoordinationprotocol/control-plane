import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../db/database.service';
import { webhooks } from '../db/schema';

@Injectable()
export class WebhookRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: { url: string; events: string[]; secret: string }) {
    const id = randomUUID();
    await this.database.db.insert(webhooks).values({
      id,
      url: input.url,
      events: input.events,
      secret: input.secret,
      active: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return this.findById(id);
  }

  async findById(id: string) {
    const rows = await this.database.db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listActive() {
    return this.database.db.select().from(webhooks).where(eq(webhooks.active, 1));
  }

  async list() {
    return this.database.db.select().from(webhooks);
  }

  async delete(id: string) {
    await this.database.db.delete(webhooks).where(eq(webhooks.id, id));
  }
}
