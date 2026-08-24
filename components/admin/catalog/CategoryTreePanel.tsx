'use client';

// components/admin/catalog/CategoryTreePanel.tsx
//
// The navigation tree the storefront menu is built from.
//
// Replaces a flat list of six hardcoded names. Nesting is the whole point of this
// tab — `categories.parent_id` has existed all along with nothing to edit it — so
// rows render recursively with a collapse toggle per parent, as the mock does.

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Edit, FolderTree, Trash2 } from 'lucide-react';

import {
  Chip,
  IconAction,
  PanelError,
  PanelPlaceholder,
  PanelShell,
  SlugChip,
} from './primitives';
import type { AdminCategoryRow } from '@/types';

interface TreeNode {
  row: AdminCategoryRow;
  children: TreeNode[];
}

const byOrder = (a: TreeNode, b: TreeNode) =>
  a.row.displayOrder - b.row.displayOrder || a.row.name.localeCompare(b.row.name);

/**
 * Turns the flat rows into a forest.
 *
 * Two rows are lifted to the top rather than dropped: one whose `parentId` names a
 * category that isn't in the list, and one sitting in a parent loop left over from
 * older data (the API refuses to create either now). Both would otherwise vanish
 * from the tree with no row to click to fix them — and a loop walked naively would
 * recurse until the tab froze.
 */
function buildTree(rows: AdminCategoryRow[]): TreeNode[] {
  const nodes = new Map<number, TreeNode>(rows.map((row) => [row.id, { row, children: [] }]));
  const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
  const roots: TreeNode[] = [];

  /** True when walking up from `id` returns to somewhere it has already been. */
  const loops = (id: number) => {
    const seen = new Set<number>();
    let current: number | null = id;
    while (current !== null) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
    return false;
  };

  for (const node of nodes.values()) {
    const parent = node.row.parentId === null ? undefined : nodes.get(node.row.parentId);
    if (parent && !loops(node.row.id)) parent.children.push(node);
    else roots.push(node);
  }

  const sortDeep = (list: TreeNode[]) => {
    list.sort(byOrder);
    list.forEach((node) => sortDeep(node.children));
  };
  sortDeep(roots);

  return roots;
}

export const CategoryTreePanel: React.FC<{
  categories: AdminCategoryRow[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: () => void;
  onEdit: (category: AdminCategoryRow) => void;
  onRetire: (category: AdminCategoryRow) => void;
}> = ({ categories, isLoading, error, onReload, onAdd, onEdit, onRetire }) => {
  // Collapsed rather than expanded, so the tree opens showing everything and the
  // toggle is there to tuck a long branch away.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const tree = useMemo(() => buildTree(categories), [categories]);

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const { row, children } = node;
    const isCollapsed = collapsed.has(row.id);

    return (
      <React.Fragment key={row.id}>
        <div
          // Indent by depth. An inline style rather than `ml-${depth * 6}`, which
          // Tailwind never generates because it only scans literal class names.
          style={{ marginLeft: depth * 22 }}
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            row.isActive ? 'border-gray-200 bg-gray-50/50' : 'border-dashed border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {children.length > 0 ? (
              <button
                type="button"
                onClick={() => toggle(row.id)}
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${row.name}`}
                className="mt-0.5 p-0.5 text-gray-500 hover:text-gray-900 rounded"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            ) : (
              // Keeps every row's text on the same left edge whether or not it has
              // a toggle, so the indentation reads as hierarchy and not as noise.
              <span className="w-5 shrink-0" aria-hidden="true" />
            )}

            <div className="min-w-0">
              <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-[#0056b3] shrink-0" />
                <span className="truncate">{row.name}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                <SlugChip>{row.slug}</SlugChip>
                <span>&bull; {row.productCount} active products assigned</span>
                {children.length > 0 && (
                  <span>
                    &bull; {children.length} subcategor{children.length === 1 ? 'y' : 'ies'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {row.isActive ? (
              <Chip tone="emerald">Active Menu Item</Chip>
            ) : (
              <Chip tone="gray">Hidden</Chip>
            )}
            <IconAction label={`Edit ${row.name}`} onClick={() => onEdit(row)}>
              <Edit className="w-4 h-4" />
            </IconAction>
            <IconAction
              label={row.isActive ? `Retire ${row.name}` : 'Already retired'}
              tone="danger"
              disabled={!row.isActive}
              onClick={() => onRetire(row)}
            >
              <Trash2 className="w-4 h-4" />
            </IconAction>
          </div>
        </div>

        {!isCollapsed && children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <PanelShell
      title="Category Hierarchy & Navigation Tree"
      subtitle="Drives the storefront menu and the category grid. Retired categories stay listed here so they can be brought back."
      actionLabel="Add Category"
      onAction={onAdd}
    >
      {error && <PanelError message={error} onRetry={onReload} />}

      {!error && isLoading && categories.length === 0 && (
        <PanelPlaceholder>Loading categories…</PanelPlaceholder>
      )}

      {!error && !isLoading && categories.length === 0 && (
        <PanelPlaceholder>No categories yet — add the first one.</PanelPlaceholder>
      )}

      {tree.length > 0 && <div className="space-y-3">{tree.map((node) => renderNode(node, 0))}</div>}
    </PanelShell>
  );
};
