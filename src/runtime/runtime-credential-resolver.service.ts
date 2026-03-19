import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { RuntimeCredentialResolver, RuntimeCredentials } from '../contracts/runtime';

@Injectable()
export class RuntimeCredentialResolverService implements RuntimeCredentialResolver {
  constructor(private readonly config: AppConfigService) {}

  async resolve(req: {
    runtimeKind: string;
    requester?: { actorId?: string; actorType?: string };
    participant?: { id: string; transportIdentity?: string };
    fallbackSender?: string;
  }): Promise<RuntimeCredentials> {
    const sender =
      req.participant?.transportIdentity ??
      req.participant?.id ??
      req.requester?.actorId ??
      req.fallbackSender ??
      this.config.runtimeDevAgentId;

    const metadata: Record<string, string> = {};
    if (this.config.runtimeBearerToken) {
      metadata.authorization = `Bearer ${this.config.runtimeBearerToken}`;
    }
    if (!metadata.authorization && this.config.runtimeUseDevHeader) {
      metadata['x-macp-agent-id'] = sender;
    }

    return { metadata, sender };
  }
}
