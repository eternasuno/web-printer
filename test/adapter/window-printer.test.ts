import { describe, expect, it, vi } from 'vitest';
import { createWindowPrinter } from '../../src/adapter/window-printer';

describe('printHtml', () => {
  it('returns without error when popup is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(createWindowPrinter().printHtml('<html></html>')).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });

  it('writes HTML to new window and calls print', async () => {
    vi.useFakeTimers();
    const mockDoc = { close: vi.fn(), write: vi.fn() };
    const mockWin = {
      closed: false,
      document: mockDoc,
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window & { closed: boolean };

    vi.spyOn(window, 'open').mockReturnValue(mockWin);

    const promise = createWindowPrinter().printHtml('<html>test</html>');

    await vi.advanceTimersByTimeAsync(500);
    expect(mockDoc.write).toHaveBeenCalledWith('<html>test</html>');
    expect(mockWin.print).toHaveBeenCalled();

    mockWin.closed = true;
    await vi.advanceTimersByTimeAsync(600);

    await promise;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
