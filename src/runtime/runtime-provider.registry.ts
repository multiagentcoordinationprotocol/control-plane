import { Injectable, NotFoundException } from '@nestjs/common';
import { RuntimeCapabilities, RuntimeProvider } from '../contracts/runtime';
import { RustRuntimeProvider } from './rust-runtime.provider';

@Injectable()
export class RuntimeProviderRegistry {
  private readonly providers = new Map<string, RuntimeProvider>();
  private readonly capabilities = new Map<string, RuntimeCapabilities>();

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

  setCapabilities(kind: string, caps: RuntimeCapabilities): void {
    this.capabilities.set(kind, caps);
  }

  getCapabilities(kind: string): RuntimeCapabilities | undefined {
    return this.capabilities.get(kind);
  }

  listKinds(): string[] {
    return Array.from(this.providers.keys());
  }
}
