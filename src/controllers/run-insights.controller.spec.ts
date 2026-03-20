import { RunInsightsController } from './run-insights.controller';
import { RunInsightsService } from '../insights/run-insights.service';

describe('RunInsightsController', () => {
  let controller: RunInsightsController;
  let mockInsightsService: {
    exportRun: jest.Mock;
    compareRuns: jest.Mock;
  };

  beforeEach(() => {
    mockInsightsService = {
      exportRun: jest.fn(),
      compareRuns: jest.fn()
    };
    controller = new RunInsightsController(
      mockInsightsService as unknown as RunInsightsService
    );
  });

  describe('exportRun', () => {
    it('delegates to insightsService.exportRun with options', async () => {
      const bundle = { run: { id: 'run-1' }, exportedAt: '2026-01-01T00:00:00Z' };
      mockInsightsService.exportRun.mockResolvedValue(bundle);

      const query = { includeCanonical: true, includeRaw: false, eventLimit: 500 };
      const result = await controller.exportRun('run-1', query as any);

      expect(mockInsightsService.exportRun).toHaveBeenCalledWith('run-1', {
        includeCanonical: true,
        includeRaw: false,
        eventLimit: 500
      });
      expect(result).toEqual(bundle);
    });

    it('passes undefined options when query is empty', async () => {
      mockInsightsService.exportRun.mockResolvedValue({});

      await controller.exportRun('run-1', {} as any);

      expect(mockInsightsService.exportRun).toHaveBeenCalledWith('run-1', {
        includeCanonical: undefined,
        includeRaw: undefined,
        eventLimit: undefined
      });
    });
  });

  describe('compareRuns', () => {
    it('delegates to insightsService.compareRuns', async () => {
      const comparison = { statusMatch: true, left: {}, right: {} };
      mockInsightsService.compareRuns.mockResolvedValue(comparison);

      const body = { leftRunId: 'run-1', rightRunId: 'run-2' };
      const result = await controller.compareRuns(body as any);

      expect(mockInsightsService.compareRuns).toHaveBeenCalledWith('run-1', 'run-2');
      expect(result).toEqual(comparison);
    });
  });
});
