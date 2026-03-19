import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | undefined;

export async function startTelemetry(options: {
  enabled: boolean;
  serviceName: string;
}): Promise<void> {
  if (!options.enabled) return;
  sdk = new NodeSDK({
    serviceName: options.serviceName,
    instrumentations: [getNodeAutoInstrumentations()]
  });
  await sdk.start();
}

export async function stopTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}
