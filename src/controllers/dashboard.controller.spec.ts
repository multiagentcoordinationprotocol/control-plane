import { DashboardController } from './dashboard.controller';
import { DashboardService } from '../dashboard/dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let mockService: { getOverview: jest.Mock };

  beforeEach(() => {
    mockService = { getOverview: jest.fn() };
    controller = new DashboardController(
      mockService as unknown as DashboardService
    );
  });

  it('returns overview with default 24h range', async () => {
    const overview = {
      kpis: { totalRuns: 10, activeRuns: 2, completedRuns: 7, failedRuns: 1, cancelledRuns: 0, avgDurationMs: 5000 },
      charts: {
        runVolume: { labels: ['2026-04-04T00:00:00Z'], data: [10] },
        latency: { labels: [], data: [] },
        signalVolume: { labels: [], data: [] },
        errorClasses: { labels: ['RUNTIME_TIMEOUT'], data: [1] }
      }
    };
    mockService.getOverview.mockResolvedValue(overview);

    const result = await controller.getOverview({ range: undefined });

    expect(mockService.getOverview).toHaveBeenCalledWith('24h');
    expect(result).toEqual(overview);
  });

  it('passes custom range to service', async () => {
    mockService.getOverview.mockResolvedValue({ kpis: {}, charts: {} });

    await controller.getOverview({ range: '7d' });

    expect(mockService.getOverview).toHaveBeenCalledWith('7d');
  });

  it('passes 30d range to service', async () => {
    mockService.getOverview.mockResolvedValue({ kpis: {}, charts: {} });

    await controller.getOverview({ range: '30d' });

    expect(mockService.getOverview).toHaveBeenCalledWith('30d');
  });
});
