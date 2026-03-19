import { Injectable } from '@nestjs/common';
import { Artifact } from '../contracts/control-plane';
import { ArtifactRepository } from '../storage/artifact.repository';

@Injectable()
export class ArtifactService {
  constructor(private readonly repository: ArtifactRepository) {}

  async register(input: Omit<Artifact, 'id' | 'createdAt'>): Promise<Artifact> {
    return this.repository.create(input);
  }

  async list(runId: string) {
    return this.repository.listByRunId(runId);
  }
}
