import type { CandidateLink, SelectedPage, SelectionState } from '../entity';

const state = (
  candidates: readonly CandidateLink[],
  selected: ReadonlySet<string>
): SelectionState => ({
  candidates,
  selected,
  canStart: selected.size > 0,
});

export const createSelection = (
  candidates: readonly CandidateLink[]
): SelectionState => state(candidates, new Set());

export const toggleSelection = (
  current: SelectionState,
  url: string
): SelectionState => {
  if (!current.candidates.some((candidate) => candidate.url === url)) {
    return current;
  }

  const selected = new Set(current.selected);
  if (selected.has(url)) {
    selected.delete(url);
  } else {
    selected.add(url);
  }

  return state(current.candidates, selected);
};

export const selectAll = (current: SelectionState): SelectionState =>
  state(
    current.candidates,
    new Set(current.candidates.map((candidate) => candidate.url))
  );

export const invertSelection = (current: SelectionState): SelectionState =>
  state(
    current.candidates,
    new Set(
      current.candidates
        .filter((candidate) => !current.selected.has(candidate.url))
        .map((candidate) => candidate.url)
    )
  );

export const selectedPages = (current: SelectionState): SelectedPage[] =>
  current.candidates.filter((candidate) => current.selected.has(candidate.url));
