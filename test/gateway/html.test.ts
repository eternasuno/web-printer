import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/gateway/html';

describe('escapeHtml', () => {
  it('escapes all four special characters', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Plain text 123')).toBe('Plain text 123');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});
