import type { Link } from '../entity';

export type SelectedIds = ReadonlySet<Link['id']>;

export const toggleSelection = (
  links: readonly Link[],
  selectedIds: SelectedIds,
  id: Link['id']
): SelectedIds => {
  if (!links.some((link) => link.id === id)) {
    return selectedIds;
  }

  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return next;
};

export const selectAll = (links: readonly Link[]): SelectedIds =>
  new Set(links.map((link) => link.id));

export const invertSelection = (
  links: readonly Link[],
  selectedIds: SelectedIds
): SelectedIds =>
  new Set(
    links.filter((link) => !selectedIds.has(link.id)).map((link) => link.id)
  );

export const selectedLinks = (
  links: readonly Link[],
  selectedIds: SelectedIds
): Link[] => links.filter((link) => selectedIds.has(link.id));
