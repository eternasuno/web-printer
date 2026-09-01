import { describe, expect, it } from 'vitest';
import {
  createSelection,
  invertSelection,
  selectAll,
  selectedPages,
  toggleSelection,
} from '../../src/usecase/select';

const candidates = [
  { url: 'https://docs.test/a', label: 'A', path: '/a', order: 0 },
  { url: 'https://docs.test/b', label: 'B', path: '/b', order: 1 },
  { url: 'https://docs.test/c', label: 'C', path: '/c', order: 2 },
];

describe('selection', () => {
  it('starts with every candidate unselected and cannot start', () => {
    const state = createSelection(candidates);

    expect(state.selected).toEqual(new Set());
    expect(state.canStart).toBe(false);
  });

  it('toggles one candidate without mutating the previous state', () => {
    const initial = createSelection(candidates);
    const selected = toggleSelection(initial, candidates[1]?.url ?? '');

    expect(initial.selected.size).toBe(0);
    expect(selected.selected).toEqual(new Set(['https://docs.test/b']));
    expect(selected.canStart).toBe(true);
  });

  it('selects all candidates', () => {
    const all = selectAll(createSelection(candidates));

    expect(all.selected.size).toBe(3);
    expect(all.canStart).toBe(true);
  });

  it('inverts the selection without mutating the previous state', () => {
    const initial = createSelection(candidates);
    const all = invertSelection(initial);
    const none = invertSelection(all);

    expect(all.selected.size).toBe(3);
    expect(all.canStart).toBe(true);
    expect(none.selected).toEqual(new Set());
    expect(none.canStart).toBe(false);
    expect(initial.selected.size).toBe(0);
  });

  it('inverts a partial selection to its complement', () => {
    let state = createSelection(candidates);
    state = toggleSelection(state, 'https://docs.test/b');
    state = toggleSelection(state, 'https://docs.test/c');

    expect(invertSelection(state).selected).toEqual(
      new Set(['https://docs.test/a'])
    );
  });

  it('returns selected pages in candidate order rather than click order', () => {
    let state = createSelection(candidates);
    state = toggleSelection(state, 'https://docs.test/c');
    state = toggleSelection(state, 'https://docs.test/a');

    expect(selectedPages(state).map((item) => item.label)).toEqual(['A', 'C']);
  });

  it('ignores an unknown candidate URL', () => {
    const initial = createSelection(candidates);

    expect(toggleSelection(initial, 'https://docs.test/missing')).toEqual(
      initial
    );
  });
});
