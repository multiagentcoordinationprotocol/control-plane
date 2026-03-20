import { Injectable } from '@nestjs/common';
import { ArtifactRepository } from '../storage/artifact.repository';
import { ArtifactStorageProvider } from './artifact-storage.interface';

@Injectable()
export class InlineArtifactStorageProvider implements ArtifactStorageProvider {
  readonly kind = 'inline';

  constructor(private readonly artifactRepository: ArtifactRepository) {}

  async store(params: {
    runId: string;
    artifactId: string;
    label: string;
    data: Buffer | Record<string, unknown>;
    contentType?: string;
  }): Promise<{ uri: string }> {
    // Inline storage is the default — data is stored directly in JSONB.
    // This provider returns a placeholder URI indicating inline storage.
    return { uri: `inline://${params.runId}/${params.artifactId}` };
  }

  async retrieve(uri: string): Promise<{ data: Buffer; contentType?: string } | null> {
    // Parse inline URI: inline://{runId}/{artifactId}
    const match = uri.match(/^inline:\/\/([^/]+)\/([^/]+)$/);
    if (!match) return null;

    const artifact = await this.artifactRepository.findById(match[2]);
    if (!artifact?.inline) return null;

    return {
      data: Buffer.from(JSON.stringify(artifact.inline), 'utf8'),
      contentType: 'application/json'
    };
  }
}
