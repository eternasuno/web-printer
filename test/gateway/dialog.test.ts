import { describe, expect, it } from 'vitest';
import type { BatchConfig } from '../../src/core/usecase';
import { DEFAULT_BATCH_CONFIG } from '../../src/core/usecase';
import { readBatchConfig } from '../../src/gateway/dialog';

describe('readBatchConfig', () => {
  it('parses valid integer strings', () => {
    const config = readBatchConfig({ concurrency: '5', interval: '200', timeout: '10000' });
    expect(config).toEqual({ concurrency: 5, interval: 200, timeout: 10000 });
  });

  it('floors decimal values', () => {
    const config = readBatchConfig({ concurrency: '2.9', interval: '0.9', timeout: '1.9' });
    expect(config).toEqual({ concurrency: 2, interval: 0, timeout: 1 });
  });

  it('falls back to defaults for empty strings', () => {
    const config = readBatchConfig({ concurrency: '', interval: '', timeout: '' });
    expect(config).toEqual(DEFAULT_BATCH_CONFIG);
  });

  it('falls back to defaults for non-numeric strings', () => {
    const config = readBatchConfig({ concurrency: 'abc', interval: 'fast', timeout: 'none' });
    expect(config).toEqual(DEFAULT_BATCH_CONFIG);
  });

  it('treats concurrency below 1 as invalid and uses the default', () => {
    const config = readBatchConfig({
      concurrency: '0',
      interval: '0',
      timeout: String(DEFAULT_BATCH_CONFIG.timeout),
    });
    expect(config.concurrency).toBe(DEFAULT_BATCH_CONFIG.concurrency);
  });

  it('allows interval of 0 (no delay between fetches)', () => {
    const config = readBatchConfig({
      concurrency: '2',
      interval: '0',
      timeout: '1000',
    });
    expect(config.interval).toBe(0);
  });

  it('treats timeout below 1 as invalid and uses the default', () => {
    const config = readBatchConfig({
      concurrency: '2',
      interval: '0',
      timeout: '0',
    });
    expect(config.timeout).toBe(DEFAULT_BATCH_CONFIG.timeout);
  });

  it('falls back to defaults for negative values', () => {
    const config: BatchConfig = readBatchConfig({
      concurrency: '-1',
      interval: '-5',
      timeout: '-10',
    });
    expect(config).toEqual(DEFAULT_BATCH_CONFIG);
  });
});
