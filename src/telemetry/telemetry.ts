import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | undefined;

export async function startTelemetry(options: {
  enabled: boolean;
  serviceName: string;
  otlpEndpoint?: string;
}): Promise<void> {
  if (!options.enabled) return;

  const sdkOptions: ConstructorParameters<typeof NodeSDK>[0] = {
    serviceName: options.serviceName,
    instrumentations: [getNodeAutoInstrumentations()]
  };

  // If OTLP endpoint is configured, the SDK will pick it up from
  // OTEL_EXPORTER_OTLP_ENDPOINT env var automatically.
  // We set it explicitly if provided via config.
  if (options.otlpEndpoint) {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = options.otlpEndpoint;
  }

  sdk = new NodeSDK(sdkOptions);
  await sdk.start();
}

export async function stopTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}
