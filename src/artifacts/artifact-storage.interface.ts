export interface ArtifactStorageProvider {
  readonly kind: string;

  store(params: {
    runId: string;
    artifactId: string;
    label: string;
    data: Buffer | Record<string, unknown>;
    contentType?: string;
  }): Promise<{ uri: string }>;

  retrieve(uri: string): Promise<{ data: Buffer; contentType?: string } | null>;
}
