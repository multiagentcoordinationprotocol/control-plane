import { Injectable, NotFoundException } from '@nestjs/common';
import { RuntimeProvider } from '../contracts/runtime';
import { RustRuntimeProvider } from './rust-runtime.provider';

@Injectable()
export class RuntimeProviderRegistry {
  constructor(private readonly rustProvider: RustRuntimeProvider) {}

  get(kind: string): RuntimeProvider {
    const providers: Record<string, RuntimeProvider> = {
      rust: this.rustProvider
    };
    const provider = providers[kind];
    if (!provider) {
      throw new NotFoundException(`runtime provider '${kind}' is not registered`);
    }
    return provider;
  }
}
