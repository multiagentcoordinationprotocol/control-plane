import { Injectable } from '@nestjs/common';
import { ArtifactStorageProvider } from './artifact-storage.interface';

@Injectable()
export class InlineArtifactStorageProvider implements ArtifactStorageProvider {
  readonly kind = 'inline';

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

  async retrieve(_uri: string): Promise<{ data: Buffer; contentType?: string } | null> {
    // Inline artifacts are read directly from the DB, not through this provider.
    return null;
  }
}
