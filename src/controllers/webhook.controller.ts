import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  ValidationPipe
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWebhookDto } from '../dto/webhook.dto';
import { WebhookService } from '../webhooks/webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new webhook subscription.' })
  @ApiBody({ type: CreateWebhookDto })
  async createWebhook(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: CreateWebhookDto
  ) {
    return this.webhookService.register({
      url: body.url,
      events: body.events ?? [],
      secret: body.secret
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all webhook subscriptions.' })
  async listWebhooks() {
    return this.webhookService.list();
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a webhook subscription.' })
  async deleteWebhook(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.webhookService.remove(id);
  }
}
