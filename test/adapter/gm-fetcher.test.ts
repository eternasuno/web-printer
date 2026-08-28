import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPage } from '../../src/adapter/gm-fetcher';

type Callback = {
  onload: (response: {
    status: number;
    responseText: string;
    responseHeaders: string;
    finalUrl?: string;
  }) => void;
  onerror: () => void;
  onabort: () => void;
};
let current: Callback;
const abort = vi.fn();

afterEach(() => vi.restoreAllMocks());

describe('GM fetcher', () => {
  it('resolves success, content type, and final URL', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', (details: Callback) => {
      current = details;
      return { abort };
    });
    const promise = fetchPage('/a', new AbortController().signal);
    current.onload({
      status: 200,
      responseText: '<html>',
      responseHeaders: 'Content-Type: text/html; charset=UTF-8\r\n',
      finalUrl: '/b',
    });
    await expect(promise).resolves.toMatchObject({
      status: 200,
      contentType: 'text/html',
      finalUrl: '/b',
    });
  });
  it.each([
    ['onerror', 'network-error'],
    ['onabort', 'cancelled'],
  ] as const)('passes %s upward without translating', async (event, code) => {
    vi.stubGlobal('GM_xmlhttpRequest', (details: Callback) => {
      current = details;
      return { abort };
    });
    const promise = fetchPage('/a', new AbortController().signal);
    current[event]();
    await expect(promise).rejects.toMatchObject({ code });
  });
  it('aborts on signal, handles already aborted signals, ignores late callbacks, and cleans listener', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', (details: Callback) => {
      current = details;
      return { abort };
    });
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const promise = fetchPage('/a', controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
    current.onload({ status: 200, responseText: '', responseHeaders: '', finalUrl: '/a' });
    expect(abort).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    const already = new AbortController();
    already.abort();
    const second = fetchPage('/b', already.signal);
    await expect(second).rejects.toMatchObject({ code: 'cancelled' });
  });
});
