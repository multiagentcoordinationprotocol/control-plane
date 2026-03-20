import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker';

describe('CircuitBreaker', () => {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    resetTimeoutMs: 5000,
  };

  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker(defaultConfig);
    jest.spyOn(Date, 'now');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('stays CLOSED on success', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('stays CLOSED when failures are below threshold', async () => {
    for (let i = 0; i < defaultConfig.failureThreshold - 1; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('opens after reaching failure threshold', async () => {
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe('OPEN');
  });

  it('rejects calls when OPEN', async () => {
    // Trip the breaker
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe('OPEN');

    // Subsequent call should be rejected without executing the function
    const fn = jest.fn().mockResolvedValue('should not run');
    await expect(breaker.execute(fn)).rejects.toThrow(
      'Circuit breaker is OPEN',
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    let now = 1000;
    (Date.now as jest.Mock).mockImplementation(() => now);

    // Trip the breaker
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe('OPEN');

    // Advance time past the reset timeout
    now += defaultConfig.resetTimeoutMs;
    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('closes on success in HALF_OPEN', async () => {
    let now = 1000;
    (Date.now as jest.Mock).mockImplementation(() => now);

    // Trip the breaker
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }

    // Advance time past reset timeout to enter HALF_OPEN
    now += defaultConfig.resetTimeoutMs;
    expect(breaker.getState()).toBe('HALF_OPEN');

    // A successful call should close the circuit
    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('re-opens on failure in HALF_OPEN', async () => {
    let now = 1000;
    (Date.now as jest.Mock).mockImplementation(() => now);

    // Trip the breaker
    for (let i = 0; i < defaultConfig.failureThreshold; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }

    // Advance time past reset timeout to enter HALF_OPEN
    now += defaultConfig.resetTimeoutMs;
    expect(breaker.getState()).toBe('HALF_OPEN');

    // A failure in HALF_OPEN should re-open the circuit
    // The failure count was already at threshold; one more failure pushes it above
    await expect(
      breaker.execute(() => Promise.reject(new Error('still failing'))),
    ).rejects.toThrow('still failing');
    expect(breaker.getState()).toBe('OPEN');
  });

  it('resets failure count on success', async () => {
    // Accumulate failures just below threshold
    for (let i = 0; i < defaultConfig.failureThreshold - 1; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe('CLOSED');

    // A success should reset the failure count
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getState()).toBe('CLOSED');

    // Now we need the full threshold again to trip the breaker
    for (let i = 0; i < defaultConfig.failureThreshold - 1; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail'))),
      ).rejects.toThrow('fail');
    }
    // Should still be CLOSED because count was reset
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('returns the value from the executed function', async () => {
    const result = await breaker.execute(() =>
      Promise.resolve({ data: 'hello' }),
    );
    expect(result).toEqual({ data: 'hello' });
  });

  it('propagates the original error from the executed function', async () => {
    const originalError = new Error('specific error');
    await expect(breaker.execute(() => Promise.reject(originalError))).rejects.toBe(
      originalError,
    );
  });
});
