import { describe, expect, it } from 'vitest';
import type { Link } from '../../src/entity';
import {
  invertSelection,
  type SelectedIds,
  selectAll,
  selectedLinks,
  toggleSelection,
} from '../../src/usecase/select';

const link = (id: number, label: string): Link => ({
  id,
  url: `https://docs.test/${label}`,
  label,
  path: `/${label}`,
});

const links = [link(0, 'a'), link(1, 'b'), link(2, 'c')];
const none: SelectedIds = new Set<number>();

describe('selection', () => {
  it('toggles one id without mutating the previous selection', () => {
    const selected = toggleSelection(links, none, 1);

    expect(none.size).toBe(0);
    expect(selected).toEqual(new Set([1]));
    expect(toggleSelection(links, selected, 1)).toEqual(new Set());
  });

  it('selects every link', () => {
    const all = selectAll(links);

    expect(none).toEqual(new Set<number>());
    expect(all).toEqual(new Set([0, 1, 2]));
    expect(all.size).toBe(3);
  });

  it('inverts the selection without mutating the previous selection', () => {
    const all = invertSelection(links, none);
    const empty = invertSelection(links, all);

    expect(all).toEqual(new Set([0, 1, 2]));
    expect(empty).toEqual(new Set<number>());
    expect(none.size).toBe(0);
  });

  it('inverts a partial selection to its complement', () => {
    let selected = toggleSelection(links, none, 1);
    selected = toggleSelection(links, selected, 2);

    expect(invertSelection(links, selected)).toEqual(new Set([0]));
  });

  it('returns selected links in discovery order rather than click order', () => {
    let selected = toggleSelection(links, none, 2);
    selected = toggleSelection(links, selected, 0);

    expect(selectedLinks(links, selected).map((item) => item.label)).toEqual([
      'a',
      'c',
    ]);
  });

  it('keys selection by id when ids are not contiguous', () => {
    const sparse = [link(5, 'a'), link(9, 'b'), link(7, 'c')];
    const all = selectAll(sparse);

    expect(Array.from(all)).toEqual([5, 9, 7]);
    expect(selectedLinks(sparse, all).map((item) => item.label)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(
      selectedLinks(sparse, toggleSelection(sparse, all, 9)).map(
        (item) => item.id
      )
    ).toEqual([5, 7]);
  });

  it('ignores an unknown id', () => {
    const unchanged = toggleSelection(links, none, 99);

    expect(unchanged).toBe(none);
    expect(selectedLinks(links, unchanged)).toEqual([]);
  });
});
