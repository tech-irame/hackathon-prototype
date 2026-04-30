import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, FileText, Layers,
  Search, Upload, MoreHorizontal, Plus, X,
  Pencil, Download, CheckCircle2, Trash2,
  RotateCcw, Unplug,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import {
  DateFilterPicker, dateInFilter, isDateFilterActive, dateFilterLabel,
  DEFAULT_DATE_FILTER, type DateFilter,
} from '../shared/DateFilterPicker';
import DataSourceDetailView from './DataSourceDetailView';
import DataPickerModal, { type AttachmentSelection } from '../chat/DataPickerModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import {
  TODAY, INTEGRATED_TYPES, TYPE_META, formatDate,
  type DataSource, type SourceType,
} from './sources';
import { DATASET_FILES, type FileFormat } from './datasetFiles';

// Mutable copy — supports inline rename without forcing a parent-level state lift.
let SOURCES_STATE: DataSource[] | null = null;

// ─── Upload helpers ──────────────────────────────────────────────────────────

const KB = 1024;
const MB = KB * 1024;
function formatBytesShort(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

function formatExt(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return 'FILE';
  return name.slice(dot + 1).toUpperCase();
}

// Map a filename's extension onto the DatasetFile FileFormat enum. DOCX → DOC.
function fileFormat(name: string): FileFormat {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'pdf')  return 'PDF';
  if (ext === 'csv')  return 'CSV';
  if (ext === 'xlsx') return 'XLSX';
  if (ext === 'doc' || ext === 'docx') return 'DOC';
  return 'DOC';
}

// First path segment, or null if the file isn't in any folder.
function rootFolder(path: string | undefined, name: string): string | null {
  if (!path || path === name) return null;
  const sep = path.indexOf('/');
  return sep > 0 ? path.slice(0, sep) : null;
}

// Append (2), (3)… until the name doesn't collide with anything already in use.
function dedupeName(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) return desired;
  const dot = desired.lastIndexOf('.');
  const base = dot > 0 ? desired.slice(0, dot) : desired;
  const ext  = dot > 0 ? desired.slice(dot) : '';
  let i = 2;
  while (taken.has(`${base} (${i})${ext}`)) i += 1;
  return `${base} (${i})${ext}`;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabId = 'all' | 'file' | 'integrated';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'all',        label: 'All',            icon: Layers },
  { id: 'file',       label: 'Files',          icon: FileText },
  { id: 'integrated', label: 'Integrated DBs', icon: Database },
];

// ─── Time bucketing ──────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket { id: string; label: string; items: DataSource[]; }

function bucketByDate(items: DataSource[]): Bucket[] {
  const buckets: Bucket[] = [
    { id: 'today',   label: 'Today',       items: [] },
    { id: 'week',    label: 'Last 7 days', items: [] },
    { id: 'earlier', label: 'Earlier',     items: [] },
  ];
  items.forEach(d => {
    const created = new Date(d.createdAt);
    const ageMs = TODAY.getTime() - created.getTime();
    if (created.toDateString() === TODAY.toDateString()) buckets[0].items.push(d);
    else if (ageMs < 7 * DAY_MS) buckets[1].items.push(d);
    else buckets[2].items.push(d);
  });
  return buckets.filter(b => b.items.length > 0);
}

// ─── Source card ─────────────────────────────────────────────────────────────

interface SourceCardProps {
  source: DataSource;
  onOpen: () => void;
  onRemove: (id: string) => void;
  onRenameInDetail: () => void;
}

function SourceCard({ source, onOpen, onRemove, onRenameInDetail }: SourceCardProps) {
  const { icon: Icon, tone } = TYPE_META[source.type];
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isIntegrated = INTEGRATED_TYPES.includes(source.type);

  const handleConfirmRemove = () => {
    onRemove(source.id);
    setConfirmOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="group w-full flex items-center gap-3 px-4 h-16 rounded-lg bg-canvas-elevated border border-canvas-border hover:border-brand-200 hover:bg-brand-50/30 transition-colors cursor-pointer text-left"
      >
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-ink-900 truncate">{source.name}</div>
          <div className="text-[11px] text-ink-500 mt-0.5 tabular-nums truncate">
            {source.subtype} · <span className="text-ink-400">{formatDate(source.createdAt)}</span>
          </div>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setMenuOpen(o => !o); } }}
          className={`p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-50 transition-opacity cursor-pointer shrink-0 ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          aria-label="Source actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={16} />
        </span>
      </button>
      {menuOpen && (
        <SourceMenu
          source={source}
          onClose={() => setMenuOpen(false)}
          onRequestRemove={() => setConfirmOpen(true)}
          onRename={onRenameInDetail}
        />
      )}
      <ConfirmationModal
        open={confirmOpen}
        title={isIntegrated ? `Disconnect "${source.name}"?` : `Remove "${source.name}"?`}
        description={
          isIntegrated
            ? 'This connection will be removed from Knowledge Hub. Anything that references it (chats, dashboards, workflows) will lose access.'
            : 'This file will be removed from Knowledge Hub. Anything that references it (chats, dashboards, workflows) will lose access.'
        }
        confirmLabel={isIntegrated ? 'Disconnect' : 'Remove'}
        tone="destructive"
        onConfirm={handleConfirmRemove}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ─── Source actions menu ─────────────────────────────────────────────────────
// Universal: Open, Rename, Share, Copy reference. Type-specific: Download for
// files, Refresh + Test connection for integrated sources. Destructive: Remove.

interface SourceMenuProps {
  source: DataSource;
  onClose: () => void;
  onRequestRemove: () => void;
  onRename: () => void;
}

function SourceMenu({ source, onClose, onRequestRemove, onRename }: SourceMenuProps) {
  const { addToast } = useToast();
  const isIntegrated = INTEGRATED_TYPES.includes(source.type);

  // Wraps a handler so it always closes the menu after firing.
  const handle = (fn: () => void) => () => { fn(); onClose(); };

  // File-type actions
  const download = () => addToast({ type: 'info', message: `Downloading ${source.name}…` });

  // DB / API / cloud actions
  const refreshSchema = () => {
    addToast({ type: 'info', message: `Refreshing schema for ${source.name}…` });
    setTimeout(() => addToast({ type: 'success', message: `${source.name} schema refreshed.` }), 900);
  };
  const testConnection = () => {
    addToast({ type: 'info', message: `Testing connection to ${source.name}…` });
    setTimeout(() => addToast({ type: 'success', message: `${source.name}: connection ok.` }), 900);
  };

  return (
    <>
      {/* Backdrop — captures outside clicks. Invisible. */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        role="menu"
        className="absolute right-2 top-12 z-40 w-56 rounded-md border border-paper-200 bg-paper-0 shadow-md py-1"
        onClick={(e) => e.stopPropagation()}
      >
        {isIntegrated ? (
          // DB / API / cloud menu
          <>
            <MenuItem icon={Pencil}       label="Rename"            onClick={handle(onRename)} />
            <MenuSeparator />
            <MenuItem icon={RotateCcw}    label="Refresh schema"    onClick={handle(refreshSchema)} />
            <MenuItem icon={CheckCircle2} label="Test connection"   onClick={handle(testConnection)} />
            <MenuSeparator />
            <MenuItem icon={Unplug}       label="Disconnect"        onClick={handle(onRequestRemove)} destructive />
          </>
        ) : (
          // File menu (also covers session sources, which are chat-attached files)
          <>
            <MenuItem icon={Pencil}       label="Rename"            onClick={handle(onRename)} />
            <MenuSeparator />
            <MenuItem icon={Download}     label="Download"          onClick={handle(download)} />
            <MenuSeparator />
            <MenuItem icon={Trash2}       label="Remove"            onClick={handle(onRequestRemove)} destructive />
          </>
        )}
      </div>
    </>
  );
}

function MenuItem({
  icon: Icon, label, onClick, destructive,
}: { icon: React.ElementType; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 h-8 text-[12.5px] font-medium text-left transition-colors cursor-pointer ${
        destructive
          ? 'text-risk-700 hover:bg-risk-50'
          : 'text-ink-800 hover:bg-paper-50'
      }`}
    >
      <Icon size={13} className="shrink-0" />
      {label}
    </button>
  );
}

function MenuSeparator() {
  return <div className="h-px bg-paper-200 my-1" aria-hidden />;
}

// ─── Filter chip ─────────────────────────────────────────────────────────────
// Small dismissible chip used in the active-filters bar. Clear-on-X removes
// just that one filter dimension without touching the others.

function FilterChip({ label, onClear }: { label: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-7 rounded-full bg-brand-50 border border-brand-200 text-[12px] text-brand-700">
      {label}
      <button
        onClick={onClear}
        className="p-0.5 rounded-full hover:bg-brand-100 cursor-pointer"
        aria-label="Clear this filter"
      >
        <X size={11} />
      </button>
    </span>
  );
}


// ─── DataSourcesView ─────────────────────────────────────────────────────────


export default function DataSourcesView() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<DataSource | null>(null);
  // When the menu's Rename is clicked, we set this so the detail view enters
  // rename mode immediately on mount. Cleared after the detail view consumes it.
  const [pendingRename, setPendingRename] = useState(false);
  // Local sources state — starts empty on local so the empty state is visible.
  // SOURCES_STATE still wins if the user has already added/removed sources in
  // this session; SEED is no longer loaded by default. To restore demo data,
  // change `?? []` back to `?? SEED`.
  const [sources, setSources] = useState<DataSource[]>(() => SOURCES_STATE ?? []);
  // Single unified picker — same multi-tab UX as the chat composer's Add data.
  const [pickerOpen, setPickerOpen] = useState(false);

  const tabCounts = useMemo<Record<TabId, number>>(() => ({
    all:        sources.length,
    file:       sources.filter(d => d.type === 'file').length,
    integrated: sources.filter(d => INTEGRATED_TYPES.includes(d.type)).length,
  }), [sources]);

  // Total count within the active tab — used to show "X of N" when filtered.
  const tabTotal = useMemo(() => {
    if (tab === 'all') return sources.length;
    if (tab === 'file') return sources.filter(d => d.type === 'file').length;
    return sources.filter(d => INTEGRATED_TYPES.includes(d.type)).length;
  }, [sources, tab]);

  const visible = useMemo(() => {
    return sources
      .filter(d => {
        if (tab === 'all') return true;
        if (tab === 'file') return d.type === 'file';
        return INTEGRATED_TYPES.includes(d.type);
      })
      .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.subtype.toLowerCase().includes(search.toLowerCase()))
      .filter(d => dateInFilter(d.createdAt, dateFilter, TODAY))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sources, tab, search, dateFilter]);

  const dateActive = isDateFilterActive(dateFilter);
  const isFiltered = search.trim() !== '' || dateActive;
  const dateLabel = dateFilterLabel(dateFilter);
  const clearAllFilters = () => { setSearch(''); setDateFilter(DEFAULT_DATE_FILTER); };

  const renameSource = (id: string, newName: string) => {
    setSources(prev => {
      const next = prev.map(s => s.id === id ? { ...s, name: newName } : s);
      SOURCES_STATE = next;
      return next;
    });
    setActiveSource(curr => curr && curr.id === id ? { ...curr, name: newName } : curr);
  };

  const removeSource = (id: string) => {
    const removed = sources.find(s => s.id === id);
    setSources(prev => {
      const next = prev.filter(s => s.id !== id);
      SOURCES_STATE = next;
      return next;
    });
    if (removed) {
      const verb = INTEGRATED_TYPES.includes(removed.type) ? 'Disconnected' : 'Removed';
      addToast({ type: 'info', message: `${verb} "${removed.name}".` });
    }
  };

  const handlePickerConfirm = (selections: AttachmentSelection[]) => {
    const uploads   = selections.filter((s): s is Extract<AttachmentSelection, { kind: 'upload' }>     => s.kind === 'upload');
    const dbConnect = selections.filter((s): s is Extract<AttachmentSelection, { kind: 'connect-db' }> => s.kind === 'connect-db');

    // Split uploads into folder groups (one source per folder) vs loose files
    // (one source per file). Files in the same root folder become the contents
    // of that folder's source via DATASET_FILES.
    const folders = new Map<string, typeof uploads>();
    const loose:   typeof uploads = [];
    for (const u of uploads) {
      const root = rootFolder(u.path, u.name);
      if (root) {
        const arr = folders.get(root) ?? [];
        arr.push(u);
        folders.set(root, arr);
      } else {
        loose.push(u);
      }
    }
    const folderCount = folders.size;
    const looseCount  = loose.length;
    const totalFiles  = uploads.length;

    if (uploads.length > 0 || dbConnect.length > 0) {
      setSources(prev => {
        const taken = new Set(prev.map(s => s.name));
        // Seed data is anchored to TODAY (2026-04-23); use the same anchor for
        // new uploads so they land in the visible 'Today' bucket and pass the
        // default date filter, which is computed relative to TODAY.
        const nowIso = TODAY.toISOString();
        const today  = nowIso.slice(0, 10);

        // ── Loose-file sources: one card per file ────────────────────────
        const looseAdds: DataSource[] = loose.map(u => {
          const finalName = dedupeName(u.name, taken);
          taken.add(finalName);
          const sourceId = `upl-${u.localId}`;
          // Single-file content for the detail view.
          DATASET_FILES[sourceId] = [{
            id:         `${sourceId}-1`,
            name:       u.name,
            format:     fileFormat(u.name),
            sizeBytes:  u.sizeBytes,
            uploadedAt: today,
            status:     'processed',
          }];
          return {
            id:        sourceId,
            name:      finalName,
            type:      'file' as SourceType,
            subtype:   `${formatExt(finalName)} · ${formatBytesShort(u.sizeBytes)}`,
            createdAt: nowIso,
          };
        });

        // ── Folder sources: one card per folder, files inside ────────────
        const folderAdds: DataSource[] = [];
        folders.forEach((files, folderName) => {
          const finalName = dedupeName(folderName, taken);
          taken.add(finalName);
          const sourceId  = `upl-folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);
          // File contents — strip the root folder prefix so display is "Q1/sales.csv".
          DATASET_FILES[sourceId] = files.map((f, i) => ({
            id:         `${sourceId}-${i + 1}`,
            name:       f.path ? f.path.replace(`${folderName}/`, '') : f.name,
            format:     fileFormat(f.name),
            sizeBytes:  f.sizeBytes,
            uploadedAt: today,
            status:     'processed',
          }));
          folderAdds.push({
            id:        sourceId,
            name:      finalName,
            type:      'file' as SourceType,
            subtype:   `Folder · ${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatBytesShort(totalSize)}`,
            createdAt: nowIso,
          });
        });

        // ── DB sources ───────────────────────────────────────────────────
        const dbAdds: DataSource[] = dbConnect.map(d => {
          const finalName = dedupeName(d.name, taken);
          taken.add(finalName);
          return {
            id:        `db-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name:      finalName,
            type:      'database' as SourceType,
            subtype:   `${d.dbType} · ${d.database}`,
            createdAt: nowIso,
          };
        });

        const next = [...folderAdds, ...looseAdds, ...dbAdds, ...prev];
        SOURCES_STATE = next;
        return next;
      });
    }

    // Toast wording reflects what actually happened.
    if (dbConnect.length > 0) {
      addToast({ type: 'success', message: `Connected to ${dbConnect[0].name}` });
    } else if (uploads.length > 0) {
      const parts: string[] = [];
      if (folderCount > 0) parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} (${totalFiles - looseCount} files)`);
      if (looseCount > 0)  parts.push(`${looseCount} ${looseCount === 1 ? 'file' : 'files'}`);
      addToast({ type: 'success', message: `Added ${parts.join(' · ')} to Knowledge Hub.` });
    }

    setPickerOpen(false);
  };

  // Always group by relative-date buckets (Today / Last 7 days / Earlier).
  // Sort is implicit: newest-first within and across buckets.
  const buckets = bucketByDate(visible);

  // Full-page detail replaces the grid when a source is active.
  if (activeSource) {
    return (
      <DataSourceDetailView
        source={activeSource}
        onBack={() => { setActiveSource(null); setPendingRename(false); }}
        onRename={(newName) => renameSource(activeSource.id, newName)}
        startRenaming={pendingRename}
        onStartRenamingConsumed={() => setPendingRename(false)}
      />
    );
  }

  // ── True-empty state ─────────────────────────────────────────────────────
  // Distinct from the filter-empty state below (which fires when there are
  // sources but the search/date filters hide them). This one is the
  // first-run welcome — no sources at all.
  if (sources.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center text-center py-24 px-6 rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated">
          <div className="w-14 h-14 rounded-2xl border border-paper-200 bg-paper-0 flex items-center justify-center mb-5">
            <Layers size={24} className="text-ink-400" strokeWidth={1.4} />
          </div>
          <h2 className="text-[16px] font-semibold text-ink-800">Your Knowledge Hub is empty</h2>
          <p className="text-[13px] text-ink-500 mt-1.5 max-w-md leading-relaxed">
            Files, databases, and cloud sources you add here become available across the platform — chats, dashboards, and workflows all read from the same catalog.
          </p>
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-2 mt-6 px-4 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[13px] font-semibold transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add your first source
          </button>
          <p className="text-[11.5px] text-ink-400 mt-5">
            Supports PDF · CSV · XLSX · DOC. Connect PostgreSQL · MySQL · Snowflake · Oracle · SQL Server · BigQuery.
          </p>
        </div>

        <DataPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onConfirm={handlePickerConfirm}
          title="Add data"
          confirmLabel="Add"
          mode="kh-add"
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Sub-section header: pill-segmented sub-tabs + actions ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Pill-segmented sub-tabs (distinct from the outer Knowledge Hub tabs) */}
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-paper-50 border border-canvas-border">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-3 h-8 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-canvas-elevated text-brand-700 shadow-sm'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <Icon size={13} />
                {t.label}
                <span className={`tabular-nums text-[11px] ${isActive ? 'text-brand-600' : 'text-ink-400'}`}>{tabCounts[t.id]}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 px-4 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[13px] font-semibold transition-colors cursor-pointer"
        >
          <Plus size={13} />
          Add source
        </button>
      </div>

      {/* ── Search + sort toolbar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder={`Search ${tab === 'all' ? 'all sources' : TABS.find(t => t.id === tab)!.label.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[12px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 transition-colors"
          />
        </div>

        <DateFilterPicker
          filter={dateFilter}
          open={dateOpen}
          onToggle={() => setDateOpen(p => !p)}
          onClose={() => setDateOpen(false)}
          onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
          today={TODAY}
        />
      </div>

      {/* ── Active filters bar ── */}
      {/* Surfaces what's currently filtering the list + a clear-all escape.
          Result count tells the user "X of N" so the impact of filters is explicit. */}
      {isFiltered && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-ink-500 tabular-nums">
            <span className="font-semibold text-ink-700">{visible.length}</span> of {tabTotal} {tabTotal === 1 ? 'source' : 'sources'}
          </span>
          <span className="text-[12px] text-ink-400">·</span>
          {search.trim() && (
            <FilterChip
              label={<>Search: <span className="font-semibold">"{search.trim()}"</span></>}
              onClear={() => setSearch('')}
            />
          )}
          {dateActive && (
            <FilterChip
              label={<>Date: <span className="font-semibold">{dateLabel}</span></>}
              onClear={() => setDateFilter(DEFAULT_DATE_FILTER)}
            />
          )}
          <button
            onClick={clearAllFilters}
            className="text-[12px] font-medium text-brand-700 hover:text-brand-800 hover:underline cursor-pointer ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab + (search ? '+s' : '') + (dateActive ? '+d' : '')}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="space-y-6"
        >
          {visible.length === 0 && (
            <div className="text-center py-16 rounded-xl border border-dashed border-canvas-border bg-canvas-elevated">
              {isFiltered ? (
                <>
                  <Search size={28} className="mx-auto text-ink-400 mb-3" />
                  <p className="text-[14px] text-ink-700 font-medium">No sources match your filters.</p>
                  <p className="text-[12px] text-ink-500 mt-1">
                    {search.trim() && <>Search "<span className="font-semibold">{search.trim()}</span>" · </>}
                    {dateActive && <>Date "<span className="font-semibold">{dateLabel}</span>" · </>}
                    Try widening the range or clearing filters.
                  </p>
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-2 mt-4 px-3 h-9 rounded-md border border-brand-300 bg-brand-50 text-brand-700 text-[12.5px] font-semibold hover:bg-brand-100 transition-colors cursor-pointer"
                  >
                    <X size={13} />
                    Clear filters
                  </button>
                </>
              ) : tab === 'integrated' ? (
                <>
                  <Database size={28} className="mx-auto text-ink-400 mb-3" />
                  <p className="text-[14px] text-ink-700 font-medium">No integrated databases yet.</p>
                  <p className="text-[12px] text-ink-500 mt-1 max-w-md mx-auto">
                    IRA can connect to databases, APIs, cloud storage, and chat-attached files. Request an integration and IT will set it up.
                  </p>
                  <a
                    href="mailto:support@irame.ai?subject=Database%20integration%20request"
                    onClick={() => addToast({ type: 'info', message: 'Opening email…' })}
                    className="inline-flex items-center gap-2 mt-4 px-4 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[13px] font-semibold transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    Request a DB integration
                  </a>
                </>
              ) : (
                <>
                  <Upload size={28} className="mx-auto text-ink-400 mb-3" />
                  <p className="text-[14px] text-ink-700 font-medium">No sources connected yet.</p>
                  <p className="text-[12px] text-ink-500 mt-1">Upload a file or connect a source to get started.</p>
                </>
              )}
            </div>
          )}

          {buckets.map(b => (
            <div key={b.id}>
              <div className="text-[12px] font-medium text-ink-500 mb-2 tabular-nums">
                {b.label} <span className="text-ink-400">· {b.items.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {b.items.map(d => (
                  <SourceCard
                    key={d.id}
                    source={d}
                    onOpen={() => setActiveSource(d)}
                    onRemove={removeSource}
                    onRenameInDetail={() => { setPendingRename(true); setActiveSource(d); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* ── Shared add-data picker (Upload tab vs DB tab depends on entry button) ── */}
      <DataPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
        title="Add data"
        confirmLabel="Add"
        mode="kh-add"
      />
    </div>
  );
}
