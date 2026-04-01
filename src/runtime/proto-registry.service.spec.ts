// ---------------------------------------------------------------------------
// We mock protobufjs so tests don't need real .proto files on disk.
//
// The service's private lookupType does `instanceof protobuf.Type`, so
// mockLookupType must return an instance of the same class we export as Type.
// ---------------------------------------------------------------------------

// Shared mock class that will be both `protobuf.Type` and the prototype
// for values returned by `root.lookupType`.
class MockType {
  encode = jest.fn().mockReturnValue({ finish: () => Buffer.from('encoded') });
  fromObject = jest.fn().mockReturnValue({ encoded: true });
  decode = jest.fn().mockReturnValue({ decoded: true });
  toObject = jest.fn().mockReturnValue({ field: 'value' });
}

let mockTypeInstance: MockType;

const mockLookupType = jest.fn().mockImplementation(() => mockTypeInstance);
const mockLoadSync = jest.fn();

class MockRoot {
  resolvePath: any;
  lookupType = mockLookupType;
  loadSync = mockLoadSync;
}

jest.mock('protobufjs', () => {
  return {
    Root: MockRoot,
    Type: MockType
  };
});

import { ProtoRegistryService } from './proto-registry.service';

describe('ProtoRegistryService', () => {
  let service: ProtoRegistryService;

  beforeEach(() => {
    // Fresh MockType instance per test
    mockTypeInstance = new MockType();

    mockLookupType.mockReset().mockImplementation(() => mockTypeInstance);
    mockLoadSync.mockReset();

    service = new ProtoRegistryService();
    // Invoke onModuleInit to load the (mocked) proto root
    service.onModuleInit();
  });

  // =========================================================================
  // onModuleInit
  // =========================================================================
  describe('onModuleInit', () => {
    it('loads proto files via protobufjs.loadSync', () => {
      expect(mockLoadSync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('proto/macp/v1/core.proto')
        ])
      );
    });

    it('validates known types by calling lookupType', () => {
      // It should have looked up at least the core types during init
      expect(mockLookupType).toHaveBeenCalledWith('macp.v1.SessionStartPayload');
      expect(mockLookupType).toHaveBeenCalledWith('macp.v1.CommitmentPayload');
    });
  });

  // =========================================================================
  // encodePayloadEnvelope
  // =========================================================================
  describe('encodePayloadEnvelope', () => {
    it('encodes json to a UTF-8 JSON buffer', () => {
      const result = service.encodePayloadEnvelope({
        encoding: 'json',
        json: { hello: 'world' }
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(JSON.parse(result.toString('utf8'))).toEqual({ hello: 'world' });
    });

    it('encodes json with empty object when json is undefined', () => {
      const result = service.encodePayloadEnvelope({ encoding: 'json' });

      expect(JSON.parse(result.toString('utf8'))).toEqual({});
    });

    it('encodes text to a UTF-8 buffer', () => {
      const result = service.encodePayloadEnvelope({
        encoding: 'text',
        text: 'hello world'
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('utf8')).toBe('hello world');
    });

    it('encodes text with empty string when text is undefined', () => {
      const result = service.encodePayloadEnvelope({ encoding: 'text' });

      expect(result.toString('utf8')).toBe('');
    });

    it('decodes base64 to a buffer', () => {
      const original = 'binary data here';
      const b64 = Buffer.from(original).toString('base64');

      const result = service.encodePayloadEnvelope({
        encoding: 'base64',
        base64: b64
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('utf8')).toBe(original);
    });

    it('encodes proto using lookupType and encode', () => {
      const result = service.encodePayloadEnvelope({
        encoding: 'proto',
        proto: {
          typeName: 'macp.v1.SessionStartPayload',
          value: { sessionId: 'sess-1' }
        }
      });

      expect(mockLookupType).toHaveBeenCalledWith('macp.v1.SessionStartPayload');
      expect(mockTypeInstance.fromObject).toHaveBeenCalledWith({ sessionId: 'sess-1' });
      expect(result).toBeInstanceOf(Buffer);
    });

    it('normalizes snake_case proto fields before encoding', () => {
      service.encodePayloadEnvelope({
        encoding: 'proto',
        proto: {
          typeName: 'macp.v1.SessionStartPayload',
          value: {
            mode_version: '1.0.0',
            configuration_version: 'cfg-1',
            policy_version: 'policy-1',
            ttl_ms: 60000,
            roots: [{ website_url: 'https://example.test' }]
          }
        }
      });

      expect(mockTypeInstance.fromObject).toHaveBeenCalledWith({
        modeVersion: '1.0.0',
        configurationVersion: 'cfg-1',
        policyVersion: 'policy-1',
        ttlMs: 60000,
        roots: [{ websiteUrl: 'https://example.test' }]
      });
    });

    it('throws when proto input is missing proto value', () => {
      expect(() =>
        service.encodePayloadEnvelope({
          encoding: 'proto'
        } as any)
      ).toThrow('proto payload envelope requires proto value');
    });

    it('throws on unsupported encoding', () => {
      expect(() =>
        service.encodePayloadEnvelope({
          encoding: 'xml' as any
        })
      ).toThrow('unsupported payload encoding xml');
    });
  });

  // =========================================================================
  // getKnownTypeName
  // =========================================================================
  describe('getKnownTypeName', () => {
    it('returns core type for __core__ messages', () => {
      expect(service.getKnownTypeName('__core__', 'SessionStart')).toBe(
        'macp.v1.SessionStartPayload'
      );
    });

    it('returns core type when modeName does not match but messageType is core', () => {
      // Falls back to __core__ lookup
      expect(service.getKnownTypeName('unknown.mode', 'Signal')).toBe(
        'macp.v1.SignalPayload'
      );
    });

    it('returns mode-specific type for decision mode', () => {
      expect(
        service.getKnownTypeName('macp.mode.decision.v1', 'Proposal')
      ).toBe('macp.modes.decision.v1.ProposalPayload');
    });

    it('returns mode-specific type for task mode', () => {
      expect(service.getKnownTypeName('macp.mode.task.v1', 'TaskRequest')).toBe(
        'macp.modes.task.v1.TaskRequestPayload'
      );
    });

    it('returns mode-specific type for handoff mode', () => {
      expect(
        service.getKnownTypeName('macp.mode.handoff.v1', 'HandoffOffer')
      ).toBe('macp.modes.handoff.v1.HandoffOfferPayload');
    });

    it('returns mode-specific type for quorum mode', () => {
      expect(
        service.getKnownTypeName('macp.mode.quorum.v1', 'ApprovalRequest')
      ).toBe('macp.modes.quorum.v1.ApprovalRequestPayload');
    });

    it('returns undefined for unknown type in unknown mode', () => {
      expect(
        service.getKnownTypeName('unknown.mode', 'UnknownMessage')
      ).toBeUndefined();
    });
  });

  // =========================================================================
  // decodeKnown
  // =========================================================================
  describe('decodeKnown', () => {
    it('decodes a known core type via protobuf', () => {
      const payload = Buffer.from('test-data');

      const result = service.decodeKnown('__core__', 'SessionStart', payload);

      expect(mockLookupType).toHaveBeenCalledWith('macp.v1.SessionStartPayload');
      expect(mockTypeInstance.decode).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ field: 'value' });
    });

    it('decodes a known mode-specific type via protobuf', () => {
      const payload = Buffer.from('decision-data');

      service.decodeKnown('macp.mode.decision.v1', 'Proposal', payload);

      expect(mockLookupType).toHaveBeenCalledWith(
        'macp.modes.decision.v1.ProposalPayload'
      );
    });

    it('falls back to tryDecodeUtf8 for unknown types with JSON payload', () => {
      const jsonPayload = Buffer.from(JSON.stringify({ key: 'val' }), 'utf8');

      const result = service.decodeKnown(
        'unknown.mode',
        'CustomMessage',
        jsonPayload
      );

      expect(result).toEqual({
        json: { key: 'val' },
        encoding: 'json'
      });
    });

    it('falls back to tryDecodeUtf8 for unknown types with non-JSON payload', () => {
      const textPayload = Buffer.from('just plain text', 'utf8');

      const result = service.decodeKnown(
        'unknown.mode',
        'CustomMessage',
        textPayload
      );

      expect(result).toEqual({
        text: 'just plain text',
        encoding: 'text',
        payloadBase64: Buffer.from('just plain text').toString('base64')
      });
    });

    it('returns undefined for unknown types with empty payload', () => {
      const result = service.decodeKnown(
        'unknown.mode',
        'CustomMessage',
        Buffer.alloc(0)
      );

      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // encodeSessionContext
  // =========================================================================
  describe('encodeSessionContext', () => {
    it('uses encodePayloadEnvelope when contextEnvelope is provided', () => {
      const result = service.encodeSessionContext(undefined, {
        encoding: 'json',
        json: { ctx: true }
      });

      expect(JSON.parse(result.toString('utf8'))).toEqual({ ctx: true });
    });

    it('encodes context as JSON when no envelope', () => {
      const result = service.encodeSessionContext({ foo: 'bar' });

      expect(JSON.parse(result.toString('utf8'))).toEqual({ foo: 'bar' });
    });

    it('returns empty buffer when both are undefined', () => {
      const result = service.encodeSessionContext(undefined, undefined);

      expect(result.length).toBe(0);
    });
  });
});
