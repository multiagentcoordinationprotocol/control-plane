import { RuntimeController } from './runtime.controller';
import { AppConfigService } from '../config/app-config.service';
import { RuntimeProviderRegistry } from '../runtime/runtime-provider.registry';

describe('RuntimeController', () => {
  let controller: RuntimeController;
  let mockConfig: Partial<AppConfigService>;
  let mockRuntimeRegistry: { get: jest.Mock };
  let mockProvider: {
    getManifest: jest.Mock;
    listModes: jest.Mock;
    listRoots: jest.Mock;
    health: jest.Mock;
  };

  beforeEach(() => {
    mockProvider = {
      getManifest: jest.fn(),
      listModes: jest.fn(),
      listRoots: jest.fn(),
      health: jest.fn(),
    };

    mockConfig = {
      runtimeKind: 'rust',
    };

    mockRuntimeRegistry = {
      get: jest.fn().mockReturnValue(mockProvider),
    };

    controller = new RuntimeController(
      mockConfig as AppConfigService,
      mockRuntimeRegistry as unknown as RuntimeProviderRegistry,
    );
  });

  // ===========================================================================
  // getManifest
  // ===========================================================================
  describe('getManifest', () => {
    it('delegates to provider.getManifest via registry', async () => {
      const manifest = {
        agentId: 'rust-runtime',
        title: 'Rust Runtime',
        supportedModes: ['macp.mode.decision.v1'],
      };
      mockProvider.getManifest.mockResolvedValue(manifest);

      const result = await controller.getManifest();

      expect(mockRuntimeRegistry.get).toHaveBeenCalledWith('rust');
      expect(mockProvider.getManifest).toHaveBeenCalled();
      expect(result).toEqual(manifest);
    });
  });

  // ===========================================================================
  // listModes
  // ===========================================================================
  describe('listModes', () => {
    it('delegates to provider.listModes via registry', async () => {
      const modes = [
        { mode: 'macp.mode.decision.v1', modeVersion: '1.0.0', messageTypes: [], terminalMessageTypes: [] },
      ];
      mockProvider.listModes.mockResolvedValue(modes);

      const result = await controller.listModes();

      expect(mockRuntimeRegistry.get).toHaveBeenCalledWith('rust');
      expect(mockProvider.listModes).toHaveBeenCalled();
      expect(result).toEqual(modes);
    });
  });

  // ===========================================================================
  // listRoots
  // ===========================================================================
  describe('listRoots', () => {
    it('delegates to provider.listRoots via registry', async () => {
      const roots = [{ uri: 'file:///workspace', name: 'workspace' }];
      mockProvider.listRoots.mockResolvedValue(roots);

      const result = await controller.listRoots();

      expect(mockRuntimeRegistry.get).toHaveBeenCalledWith('rust');
      expect(mockProvider.listRoots).toHaveBeenCalled();
      expect(result).toEqual(roots);
    });
  });

  // ===========================================================================
  // health
  // ===========================================================================
  describe('health', () => {
    it('delegates to provider.health via registry', async () => {
      const healthResult = { ok: true, runtimeKind: 'rust' };
      mockProvider.health.mockResolvedValue(healthResult);

      const result = await controller.health();

      expect(mockRuntimeRegistry.get).toHaveBeenCalledWith('rust');
      expect(mockProvider.health).toHaveBeenCalled();
      expect(result).toEqual(healthResult);
    });

    it('returns unhealthy result when provider reports unhealthy', async () => {
      const healthResult = { ok: false, runtimeKind: 'rust', detail: 'connection refused' };
      mockProvider.health.mockResolvedValue(healthResult);

      const result = await controller.health();

      expect(result).toEqual(healthResult);
      expect(result.ok).toBe(false);
    });
  });
});
