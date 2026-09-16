// components/admin/catalog/CatalogRegistries.tsx
//
// The four reference-data registries behind the catalogue: categories, brands,
// attributes and filter tags. Everything a product needs to exist has to exist
// here first, which is why they live together and load together.
//
// All four render from Postgres via /api/categories?view=admin, /api/brands?view=admin,
// /api/catalog/attributes and /api/catalog/filter-tags. Nothing on this screen is a
// placeholder: an empty registry renders as empty, not as a plausible-looking list.

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  ChevronDown,
  Edit,
  Filter,
  FolderTree,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';

import { TAG_TONE } from './primitives';
import { CategoryFormModal } from './CategoryFormModal';
import { BrandFormModal } from './BrandFormModal';
import { AttributeFormModal } from './AttributeFormModal';
import { FilterTagFormModal } from './FilterTagFormModal';
import {
  deleteAttribute,
  deleteBrand,
  deleteCategory,
  deleteFilterTag,
  fetchRegistries,
  type AdminAttribute,
  type AdminBrand,
  type AdminCategory,
  type AdminFilterTag,
  type DeleteResult,
  type RegistrySnapshot,
} from '@/lib/api/catalog-admin';
import type { ApiResult } from '@/lib/api/storefront';

export type RegistrySubTab = 'categories' | 'brands' | 'attributes' | 'tags';

type ModalState =
  | { kind: 'category'; row: AdminCategory | null }
  | { kind: 'brand'; row: AdminBrand | null }
  | { kind: 'attribute'; row: AdminAttribute | null }
  | { kind: 'tag'; row: AdminFilterTag | null }
  | null;

/** Success/deactivation notices from a write, shown above the panel. */
type Notice = { tone: 'success' | 'warning' | 'error'; text: string } | null;

const PANEL = 'bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm';
const ADD_BUTTON =
  'bg-[#0056b3] hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95';
const ICON_BUTTON = 'p-1.5 rounded-lg transition-colors';

/* ------------------------------------------------------------------ helpers */

const Chip: React.FC<{ tone: string; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] whitespace-nowrap ${tone}`}>
    {children}
  </span>
);

const Slug: React.FC<{ value: string }> = ({ value }) => (
  <code className="bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-mono text-[10px] text-gray-600">
    {value}
  </code>
);

const StatusChip: React.FC<{ isActive: boolean; activeLabel: string }> = ({
  isActive,
  activeLabel,
}) =>
  isActive ? (
    <Chip tone="bg-emerald-50 text-emerald-700 border border-emerald-200">{activeLabel}</Chip>
  ) : (
    <Chip tone="bg-gray-100 text-gray-600 border border-gray-200">Inactive</Chip>
  );

const RowActions: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
  isBusy: boolean;
  editLabel: string;
  deleteLabel: string;
}> = ({ onEdit, onDelete, isBusy, editLabel, deleteLabel }) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      onClick={onEdit}
      title={editLabel}
      aria-label={editLabel}
      className={`${ICON_BUTTON} text-gray-600 hover:bg-gray-100`}
    >
      <Edit className="w-4 h-4" />
    </button>
    <button
      type="button"
      onClick={onDelete}
      disabled={isBusy}
      title={deleteLabel}
      aria-label={deleteLabel}
      className={`${ICON_BUTTON} text-rose-600 hover:bg-rose-50 disabled:opacity-50`}
    >
      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({
  icon,
  title,
  body,
}) => (
  <div className="py-10 flex flex-col items-center text-center gap-2">
    <span className="text-gray-300">{icon}</span>
    <p className="font-bold text-sm text-gray-700">{title}</p>
    <p className="text-xs text-gray-500 max-w-md leading-relaxed">{body}</p>
  </div>
);

/* ---------------------------------------------------------------- container */

export const CatalogRegistries: React.FC<{ subTab: RegistrySubTab }> = ({ subTab }) => {
  const [snapshot, setSnapshot] = useState<RegistrySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Re-fetch on mount and whenever `reloadToken` moves.
   *
   * The token indirection is what keeps the effect body free of a synchronous
   * `setState` — a reload is triggered from an event handler, and the state only
   * settles inside the promise continuation. `cancelled` covers the case where the
   * user leaves the tab before a slow response lands, which would otherwise write
   * to an unmounted component.
   */
  useEffect(() => {
    let cancelled = false;
    // Inactive rows included: staff editing a registry need to see a deactivated
    // row in order to reactivate it. The storefront never asks for them.
    void fetchRegistries(true).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      setSnapshot(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setIsLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * Runs a DELETE and reports what the server actually did.
   *
   * The endpoints deactivate instead of deleting when rows depend on the target —
   * a category delete would clear `products.category_id`, an attribute delete
   * cascades away every product's value for it. So the outcome is read back rather
   * than assumed, and a deactivation is reported as a deactivation.
   */
  const runDelete = useCallback(
    async (key: string, confirmText: string, call: () => Promise<ApiResult<DeleteResult>>) => {
      if (!window.confirm(confirmText)) return;
      setBusyKey(key);
      const result = await call();
      setBusyKey(null);

      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error });
        return;
      }
      setNotice(
        result.data.outcome === 'deactivated'
          ? {
              tone: 'warning',
              text: result.data.message ?? 'Deactivated instead of deleted — rows depend on it.',
            }
          : { tone: 'success', text: 'Deleted.' },
      );
      reload();
    },
    [reload],
  );

  /** A save changed counts elsewhere (a reparent moves a child), so reload rather than splice. */
  const afterSave = useCallback(
    (label: string) => {
      setModal(null);
      setNotice({ tone: 'success', text: `${label} saved.` });
      reload();
    },
    [reload],
  );

  // Memoised because these arrays feed `useMemo` dependency lists below; a fresh
  // `[]` on every render would defeat them.
  const categories = useMemo(() => snapshot?.categories ?? [], [snapshot]);
  const brands = useMemo(() => snapshot?.brands ?? [], [snapshot]);
  const attributes = useMemo(() => snapshot?.attributes ?? [], [snapshot]);
  const filterTags = useMemo(() => snapshot?.filterTags ?? [], [snapshot]);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const toggleCollapsed = (id: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isLoading && snapshot === null) {
    return (
      <div className={`${PANEL} flex items-center justify-center gap-2 py-14 text-gray-500`}>
        <Loader2 className="w-4 h-4 animate-spin text-[#0056b3]" />
        <span className="font-bold text-xs">Loading catalog reference data…</span>
      </div>
    );
  }

  if (loadError !== null && snapshot === null) {
    return (
      <div className={PANEL}>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
          <div className="space-y-2">
            <p className="font-bold text-xs">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="flex items-center gap-1.5 font-bold text-[11px] text-rose-900 underline"
            >
              <RefreshCw className="w-3 h-3" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-xs font-bold ${
            notice.tone === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notice.tone === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="leading-snug">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="underline flex-shrink-0 opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {subTab === 'categories' && (
        <CategoryTreePanel
          categories={categories}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onAdd={() => setModal({ kind: 'category', row: null })}
          onEdit={(row) => setModal({ kind: 'category', row })}
          onDelete={(row) =>
            void runDelete(
              `category-${row.id}`,
              deleteMessage({
                name: row.name,
                dependencies: [
                  [row.productCount, 'product(s) sit in it'],
                  [row.childCount, 'child categor(y/ies) sit under it'],
                ],
                deactivateNote:
                  'It will be deactivated instead of deleted, so nothing loses its category.',
              }),
              () => deleteCategory(row.id),
            )
          }
          busyKey={busyKey}
        />
      )}

      {subTab === 'brands' && (
        <BrandDirectoryPanel
          brands={brands}
          onAdd={() => setModal({ kind: 'brand', row: null })}
          onEdit={(row) => setModal({ kind: 'brand', row })}
          onDelete={(row) =>
            void runDelete(
              `brand-${row.id}`,
              deleteMessage({
                name: row.name,
                dependencies: [[row.productCount, 'product(s) are stocked under it']],
                deactivateNote:
                  'It will be deactivated instead of deleted, so no product loses its brand.',
              }),
              () => deleteBrand(row.id),
            )
          }
          busyKey={busyKey}
        />
      )}

      {subTab === 'attributes' && (
        <AttributesPanel
          attributes={attributes}
          categoryNameById={categoryNameById}
          onAdd={() => setModal({ kind: 'attribute', row: null })}
          onEdit={(row) => setModal({ kind: 'attribute', row })}
          onDelete={(row) =>
            void runDelete(
              `attribute-${row.id}`,
              deleteMessage({
                name: row.name,
                dependencies: [[row.valueCount, 'product(s) have answered it']],
                deactivateNote:
                  'It will be deactivated instead of deleted, so those answers survive.',
              }),
              () => deleteAttribute(row.id),
            )
          }
          busyKey={busyKey}
        />
      )}

      {subTab === 'tags' && (
        <FilterTagsPanel
          filterTags={filterTags}
          onAdd={() => setModal({ kind: 'tag', row: null })}
          onEdit={(row) => setModal({ kind: 'tag', row })}
          onDelete={(row) =>
            void runDelete(
              `tag-${row.id}`,
              deleteMessage({
                name: row.name,
                dependencies: [[row.productCount, 'product(s) carry it']],
                deactivateNote:
                  'It will be deactivated instead of deleted, so it stays attached to those products.',
              }),
              () => deleteFilterTag(row.id),
            )
          }
          busyKey={busyKey}
        />
      )}

      {modal?.kind === 'category' && (
        <CategoryFormModal
          categories={categories}
          editing={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => afterSave('Category')}
        />
      )}
      {modal?.kind === 'brand' && (
        <BrandFormModal
          categories={categories}
          editing={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => afterSave('Brand')}
        />
      )}
      {modal?.kind === 'attribute' && (
        <AttributeFormModal
          categories={categories}
          editing={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => afterSave('Attribute')}
        />
      )}
      {modal?.kind === 'tag' && (
        <FilterTagFormModal
          editing={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => afterSave('Filter tag')}
        />
      )}
    </>
  );
};

/**
 * The confirm text, phrased from the counts we already hold.
 *
 * It states which outcome to expect rather than asking "are you sure?", because the
 * endpoints do two different things depending on those counts and the difference
 * matters: one removes a row, the other only hides it.
 */
function deleteMessage(input: {
  name: string;
  dependencies: Array<[number, string]>;
  deactivateNote: string;
}): string {
  const blocking = input.dependencies.filter(([count]) => count > 0);
  if (blocking.length === 0) {
    return `Delete "${input.name}"? Nothing depends on it, so the row will be removed.`;
  }
  const clauses = blocking.map(([count, phrase]) => `${count} ${phrase}`).join(' and ');
  return `${clauses}. ${input.deactivateNote}\n\nContinue?`;
}

/* ------------------------------------------------------------ category tree */

interface TreeNode {
  category: AdminCategory & { childCount: number };
  children: TreeNode[];
}

/**
 * Builds the tree from `parentId`.
 *
 * A category whose parent is missing from the list — deleted, or filtered out —
 * is promoted to a root rather than dropped, so the tab can never silently hide a
 * row that exists in the table.
 */
function buildTree(categories: AdminCategory[]): TreeNode[] {
  const byId = new Map<number, AdminCategory>();
  for (const category of categories) byId.set(category.id, category);

  const childrenOf = new Map<number | null, AdminCategory[]>();
  for (const category of categories) {
    const parent =
      category.parentId !== null && byId.has(category.parentId) ? category.parentId : null;
    const bucket = childrenOf.get(parent);
    if (bucket) bucket.push(category);
    else childrenOf.set(parent, [category]);
  }

  const sort = (rows: AdminCategory[]) =>
    [...rows].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

  const build = (parentId: number | null, depth: number): TreeNode[] =>
    sort(childrenOf.get(parentId) ?? []).map((category) => {
      // Depth cap is a guard, not a feature: the API refuses to create a cycle, but
      // a row edited straight in SQL could still produce one, and infinite recursion
      // in a render is a blank screen with no clue why.
      const children = depth < 12 ? build(category.id, depth + 1) : [];
      return {
        category: { ...category, childCount: (childrenOf.get(category.id) ?? []).length },
        children,
      };
    });

  return build(null, 0);
}

const CategoryTreePanel: React.FC<{
  categories: AdminCategory[];
  collapsed: ReadonlySet<number>;
  onToggleCollapsed: (id: number) => void;
  onAdd: () => void;
  onEdit: (row: AdminCategory) => void;
  onDelete: (row: AdminCategory & { childCount: number }) => void;
  busyKey: string | null;
}> = ({ categories, collapsed, onToggleCollapsed, onAdd, onEdit, onDelete, busyKey }) => {
  const tree = useMemo(() => buildTree(categories), [categories]);

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const { category } = node;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(category.id);

    return (
      <div key={category.id}>
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
            category.isActive ? 'border-gray-200 bg-gray-50/50' : 'border-gray-200 bg-gray-100/70'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleCollapsed(category.id)}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? `Expand ${category.name}` : `Collapse ${category.name}`}
                className="p-0.5 mt-0.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>
            ) : (
              <span className="w-5 flex-shrink-0" aria-hidden="true" />
            )}

            <div className="min-w-0">
              <div className="font-bold text-sm text-gray-900 flex items-center gap-2 flex-wrap">
                <FolderTree className="w-4 h-4 text-[#0056b3] flex-shrink-0" />
                <span className="truncate">{category.name}</span>
                <StatusChip isActive={category.isActive} activeLabel="Active Menu Item" />
              </div>

              <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <Slug value={category.slug} />
                <span>
                  {category.productCount} product{category.productCount === 1 ? '' : 's'}
                </span>
                {hasChildren && (
                  <>
                    <span aria-hidden="true">&bull;</span>
                    <span>
                      {node.children.length} sub-categor
                      {node.children.length === 1 ? 'y' : 'ies'}
                    </span>
                  </>
                )}
                {category.subcategories.length > 0 && (
                  <>
                    <span aria-hidden="true">&bull;</span>
                    <span>{category.subcategories.length} drilldown label(s)</span>
                  </>
                )}
                <span aria-hidden="true">&bull;</span>
                <span>order {category.displayOrder}</span>
              </div>
            </div>
          </div>

          <RowActions
            onEdit={() => onEdit(category)}
            onDelete={() => onDelete(category)}
            isBusy={busyKey === `category-${category.id}`}
            editLabel={`Edit ${category.name}`}
            deleteLabel={`Delete ${category.name}`}
          />
        </div>

        {hasChildren && !isCollapsed && (
          <div className="ml-6 pl-4 mt-2 space-y-2 border-l-2 border-gray-200">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={PANEL}>
      <div className="flex justify-between items-start gap-4 border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-[#1a1a1a]">
            Category Hierarchy &amp; Navigation Tree
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Nested from each category&apos;s parent. Deactivating one hides it from the storefront
            menu without touching the products in it.
          </p>
        </div>
        <button type="button" onClick={onAdd} className={`${ADD_BUTTON} flex-shrink-0`}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add Category</span>
        </button>
      </div>

      {tree.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="w-8 h-8" />}
          title="No categories yet"
          body="Categories are what products, filters and the storefront menu are grouped by. Add the top-level departments first, then nest under them."
        />
      ) : (
        <div className="space-y-2">{tree.map((node) => renderNode(node, 0))}</div>
      )}
    </div>
  );
};

/* --------------------------------------------------------- brand directory */

const BrandDirectoryPanel: React.FC<{
  brands: AdminBrand[];
  onAdd: () => void;
  onEdit: (row: AdminBrand) => void;
  onDelete: (row: AdminBrand) => void;
  busyKey: string | null;
}> = ({ brands, onAdd, onEdit, onDelete, busyKey }) => {
  const sorted = useMemo(
    () =>
      [...brands].sort(
        (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name),
      ),
    [brands],
  );

  return (
    <div className={PANEL}>
      <div className="flex justify-between items-start gap-4 border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Brand Directory</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Featured brands sort first. &ldquo;Authorized Partner&rdquo; is a separate, stronger
            claim than being stocked — the storefront prints it as a warranty assurance.
          </p>
        </div>
        <button type="button" onClick={onAdd} className={`${ADD_BUTTON} flex-shrink-0`}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add Brand</span>
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Award className="w-8 h-8" />}
          title="No brands yet"
          body="Brands drive the brand pages and the brand filter on the shop. A product can be saved without one, but it will not appear under any manufacturer."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((brand) => (
            <div
              key={brand.id}
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                brand.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-100/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                    <span className="truncate">{brand.name}</span>
                    {brand.isFeatured && (
                      <Star
                        className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                        aria-label="Featured"
                      />
                    )}
                  </div>
                  <div className="mt-1">
                    <Slug value={brand.slug} />
                  </div>
                </div>
                <RowActions
                  onEdit={() => onEdit(brand)}
                  onDelete={() => onDelete(brand)}
                  isBusy={busyKey === `brand-${brand.id}`}
                  editLabel={`Edit ${brand.name}`}
                  deleteLabel={`Delete ${brand.name}`}
                />
              </div>

              <div className="text-[11px] text-gray-500 space-y-0.5">
                <div>
                  {brand.productCount} {brand.productCount === 1 ? 'SKU' : 'SKUs'} in catalog
                </div>
                <div className="truncate">
                  {brand.categorySlugs.length > 0
                    ? `Carried in: ${brand.categorySlugs.join(', ')}`
                    : 'Not scoped to any category'}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                {/* `brands.is_partner` — not every brand carried is an authorized
                    partner, and claiming it on all of them makes the badge worthless. */}
                {brand.isPartner ? (
                  <Chip tone="bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Authorized Partner
                  </Chip>
                ) : (
                  <Chip tone="bg-gray-100 text-gray-600 border border-gray-200">Stocked Brand</Chip>
                )}
                {brand.isFeatured && (
                  <Chip tone="bg-amber-50 text-amber-800 border border-amber-200">Featured</Chip>
                )}
                {!brand.isActive && (
                  <Chip tone="bg-gray-200 text-gray-700 border border-gray-300">Inactive</Chip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------- attributes */

const DATA_TYPE_CHIP: Record<AdminAttribute['dataType'], string> = {
  text: 'bg-slate-100 text-slate-700 border border-slate-200',
  number: 'bg-blue-50 text-blue-700 border border-blue-200',
  boolean: 'bg-violet-50 text-violet-700 border border-violet-200',
  select: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const DATA_TYPE_LABEL: Record<AdminAttribute['dataType'], string> = {
  text: 'Text',
  number: 'Number',
  boolean: 'Yes / No',
  select: 'Select list',
};

const AttributesPanel: React.FC<{
  attributes: AdminAttribute[];
  categoryNameById: Map<number, string>;
  onAdd: () => void;
  onEdit: (row: AdminAttribute) => void;
  onDelete: (row: AdminAttribute) => void;
  busyKey: string | null;
}> = ({ attributes, categoryNameById, onAdd, onEdit, onDelete, busyKey }) => {
  const sorted = useMemo(
    () =>
      [...attributes].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      ),
    [attributes],
  );

  return (
    <div className={PANEL}>
      <div className="flex justify-between items-start gap-4 border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-[#1a1a1a]">
            Product Specifications &amp; Filter Attributes
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            A spec defined once here, answered per product — which is what lets the shop sidebar
            group by it. Free-text spec sheets cannot be filtered on.
          </p>
        </div>
        <button type="button" onClick={onAdd} className={`${ADD_BUTTON} flex-shrink-0`}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add Attribute</span>
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Filter className="w-8 h-8" />}
          title="No attributes defined yet"
          body="Until an attribute exists, every product retypes its own spec keys — so “RAM”, “Ram” and “Memory” all coexist and nothing can be grouped by. Define the ones worth filtering on: RAM, Storage Type, Processor Brand."
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((attribute) => {
            const scopeNames = attribute.categoryIds
              .map((id) => categoryNameById.get(id))
              .filter((name): name is string => Boolean(name));

            return (
              <div
                key={attribute.id}
                className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 ${
                  attribute.isActive
                    ? 'border-gray-200 bg-gray-50/50'
                    : 'border-gray-200 bg-gray-100/70'
                }`}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="font-bold text-sm text-gray-900 flex items-center gap-2 flex-wrap">
                    <span className="truncate">{attribute.name}</span>
                    <Chip tone={DATA_TYPE_CHIP[attribute.dataType]}>
                      {DATA_TYPE_LABEL[attribute.dataType]}
                      {attribute.unit ? ` · ${attribute.unit}` : ''}
                    </Chip>
                    {attribute.isFilterable ? (
                      <Chip tone="bg-blue-50 text-blue-700 border border-blue-200">Facet</Chip>
                    ) : (
                      <Chip tone="bg-gray-100 text-gray-600 border border-gray-200">
                        Not filterable
                      </Chip>
                    )}
                    {!attribute.isActive && (
                      <Chip tone="bg-gray-200 text-gray-700 border border-gray-300">Inactive</Chip>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                    <Slug value={attribute.slug} />
                    <span aria-hidden="true">&bull;</span>
                    <span>
                      Scope:{' '}
                      {scopeNames.length > 0 ? scopeNames.join(', ') : 'every category'}
                    </span>
                    <span aria-hidden="true">&bull;</span>
                    <span>
                      {attribute.valueCount} product{attribute.valueCount === 1 ? '' : 's'} answered
                    </span>
                  </div>

                  {attribute.dataType === 'select' && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {attribute.options.length === 0 ? (
                        // A select with no options is a facet nobody can pick — the
                        // API refuses to create one, but a legacy row could exist.
                        <span className="text-[11px] font-bold text-amber-700">
                          No options — nothing can be chosen for this attribute.
                        </span>
                      ) : (
                        attribute.options.map((option) => (
                          <Chip
                            key={option.id}
                            tone="bg-white text-gray-600 border border-gray-200"
                          >
                            {option.value}
                          </Chip>
                        ))
                      )}
                    </div>
                  )}

                  {attribute.description && (
                    <p className="text-[11px] text-gray-500 italic">{attribute.description}</p>
                  )}
                </div>

                <RowActions
                  onEdit={() => onEdit(attribute)}
                  onDelete={() => onDelete(attribute)}
                  isBusy={busyKey === `attribute-${attribute.id}`}
                  editLabel={`Edit ${attribute.name}`}
                  deleteLabel={`Delete ${attribute.name}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------- filter tags */

const FilterTagsPanel: React.FC<{
  filterTags: AdminFilterTag[];
  onAdd: () => void;
  onEdit: (row: AdminFilterTag) => void;
  onDelete: (row: AdminFilterTag) => void;
  busyKey: string | null;
}> = ({ filterTags, onAdd, onEdit, onDelete, busyKey }) => {
  const sorted = useMemo(
    () =>
      [...filterTags].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      ),
    [filterTags],
  );

  return (
    <div className={PANEL}>
      <div className="flex justify-between items-start gap-4 border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-[#1a1a1a]">Cross-Cutting Filter Tags</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Merchandising labels the shop applies, kept apart from attributes on purpose:
            &ldquo;16GB RAM&rdquo; is a fact about the hardware, &ldquo;Student Pick&rdquo; is a
            decision someone makes on a Tuesday and reverses on Friday.
          </p>
        </div>
        <button type="button" onClick={onAdd} className={`${ADD_BUTTON} flex-shrink-0`}>
          <Plus className="w-3.5 h-3.5" />
          <span>Add Filter Tag</span>
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-8 h-8" />}
          title="No filter tags yet"
          body="Tags become cross-category filter pills — “Best Seller”, “Gaming”, “Under NPR 50,000”. They are assigned per product, so a tag with no products attached shows nothing on the shop."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map((tag) => {
            const tone = TAG_TONE[tag.color] ?? TAG_TONE.blue;
            return (
              <div
                key={tag.id}
                className={`p-3.5 rounded-2xl border flex items-start justify-between gap-2 ${
                  tag.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-100/70'
                }`}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 ${tone.badge}`}
                    >
                      <Tag className="w-3 h-3" />
                      {tag.name}
                    </span>
                    {!tag.isActive && (
                      <Chip tone="bg-gray-200 text-gray-700 border border-gray-300">Inactive</Chip>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                    <Slug value={tag.slug} />
                    <span aria-hidden="true">&bull;</span>
                    <span>
                      {tag.productCount} product{tag.productCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  {tag.description && (
                    <p className="text-[11px] text-gray-500 italic">{tag.description}</p>
                  )}
                </div>

                <RowActions
                  onEdit={() => onEdit(tag)}
                  onDelete={() => onDelete(tag)}
                  isBusy={busyKey === `tag-${tag.id}`}
                  editLabel={`Edit ${tag.name}`}
                  deleteLabel={`Delete ${tag.name}`}
                />
              </div>
            );
          })}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-gray-500 pt-1">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
        <span>
          Defining a tag here does not attach it to anything. Assignment happens per product, on
          the product form.
        </span>
      </p>
    </div>
  );
};
