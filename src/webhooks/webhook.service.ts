import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { WebhookRepository } from './webhook.repository';

export interface WebhookPayload {
  event: string;
  runId: string;
  status: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly webhookRepository: WebhookRepository) {}

  async register(input: { url: string; events: string[]; secret: string }) {
    return this.webhookRepository.create(input);
  }

  async list() {
    return this.webhookRepository.list();
  }

  async remove(id: string) {
    return this.webhookRepository.delete(id);
  }

  async fireEvent(payload: WebhookPayload): Promise<void> {
    const activeWebhooks = await this.webhookRepository.listActive();
    const matching = activeWebhooks.filter(
      (wh) => wh.events.length === 0 || wh.events.includes(payload.event)
    );

    for (const webhook of matching) {
      void this.deliver(webhook.url, webhook.secret, payload);
    }
  }

  private async deliver(url: string, secret: string, payload: WebhookPayload, attempt = 1): Promise<void> {
    const maxAttempts = 3;
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MACP-Signature': signature,
          'X-MACP-Event': payload.event
        },
        body,
        signal: AbortSignal.timeout(10_000)
      });

      if (!response.ok) {
        throw new Error(`webhook returned ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `webhook delivery to ${url} failed (attempt ${attempt}/${maxAttempts}): ${error instanceof Error ? error.message : String(error)}`
      );
      if (attempt < maxAttempts) {
        const backoffMs = 1000 * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.deliver(url, secret, payload, attempt + 1);
      }
    }
  }
}
