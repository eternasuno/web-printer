import { describe, expect, it } from 'vitest';
import { assemble } from '../../src/usecase/assemble';

const page = (order: number, label = `Page ${order}`) => ({
  url: `https://docs.test/${order}`,
  label,
  order,
});

describe('assemble', () => {
  it('keeps result order and marks every item after the first for pagination', () => {
    const result = assemble('Documentation', 'docs.test', [
      {
        type: 'success' as const,
        page: page(0),
        article: { title: 'A', contentHtml: '<p>A</p>' },
      },
      {
        type: 'failure' as const,
        page: page(1),
        reason: 'HTTP 404',
      },
    ]);

    expect(result.title).toBe('Documentation');
    expect(result.items.map((item) => item.type)).toEqual([
      'article',
      'failure',
    ]);
    expect(result.items.map((item) => item.breakBefore)).toEqual([false, true]);
  });

  it('summarizes successes, failures, and failure details', () => {
    const result = assemble('', 'docs.test', [
      {
        type: 'failure',
        page: page(0, 'Broken'),
        reason: 'Timeout',
      },
      {
        type: 'success',
        page: page(1),
        article: { title: 'Good', contentHtml: '<p>Good</p>' },
      },
    ]);

    expect(result.title).toBe('docs.test');
    expect(result.summary).toEqual({
      succeeded: 1,
      failed: 1,
      failures: [
        {
          label: 'Broken',
          url: 'https://docs.test/0',
          reason: 'Timeout',
        },
      ],
    });
  });

  it('uses the page title when it contains surrounding whitespace', () => {
    const result = assemble('  Guide  ', 'docs.test', []);

    expect(result.title).toBe('Guide');
    expect(result.items).toEqual([]);
  });
});
