import { Injectable, NotFoundException } from '@nestjs/common';
import { RuntimeProvider } from '../contracts/runtime';
import { RustRuntimeProvider } from './rust-runtime.provider';

@Injectable()
export class RuntimeProviderRegistry {
  private readonly providers = new Map<string, RuntimeProvider>();

  constructor(private readonly rustProvider: RustRuntimeProvider) {
    this.register(rustProvider);
  }

  register(provider: RuntimeProvider): void {
    this.providers.set(provider.kind, provider);
  }

  get(kind: string): RuntimeProvider {
    const provider = this.providers.get(kind);
    if (!provider) {
      throw new NotFoundException(`runtime provider '${kind}' is not registered`);
    }
    return provider;
  }

  listKinds(): string[] {
    return Array.from(this.providers.keys());
  }
}
