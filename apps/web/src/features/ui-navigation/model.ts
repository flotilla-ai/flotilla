export type GroupBy = 'project' | 'folder' | 'none';
export type SidebarSection = 'captains' | 'pinned' | 'folders' | 'threads';
export type BottomItem = 'threads' | 'issues' | 'pull-requests' | 'automations' | 'explore' | 'drive';
export type NavigationPrefs = { sidebarSections: SidebarSection[]; hiddenSidebarSections: SidebarSection[]; bottomItems: BottomItem[]; hiddenBottomItems: BottomItem[]; pagesTop: boolean; groupBy: GroupBy; collapsedSections: SidebarSection[] };
export type Folder = { id: string; name: string; visibility: 'private' | 'shared'; parentId?: never };
export type ThreadNav = { id: string; title: string; project: string; folderId: string | null; pinned: boolean; tags: string[]; kind?: 'thread' | 'captain' };
export type CommandCategory = 'thread' | 'pr' | 'automation' | 'settings';
export type CommandItem = { id: string; category: CommandCategory; title: string; path: string; keywords?: string[] };
export type Tab = { id: string; title: string; preview: boolean; closed?: boolean };
export type Pane = { id: string; direction: 'right' | 'down' | null; tabs: Tab[] };
export const sidebarOrder: SidebarSection[] = ['captains', 'pinned', 'folders', 'threads'];
export const bottomOrder: BottomItem[] = ['threads', 'issues', 'pull-requests', 'automations', 'explore', 'drive'];
export const defaultPrefs = (): NavigationPrefs => ({ sidebarSections: [...sidebarOrder], hiddenSidebarSections: [], bottomItems: [...bottomOrder], hiddenBottomItems: [], collapsedSections: [], pagesTop: false, groupBy: 'project' });
const uniq = <T extends string>(xs: T[], allowed: readonly T[]) => [...new Set(xs.filter((x) => allowed.includes(x)))];
export function sanitizePrefs(v: unknown): NavigationPrefs {
  const d = defaultPrefs(); if (!v || typeof v !== 'object' || Array.isArray(v)) return d; const x = v as Partial<NavigationPrefs>;
  return { sidebarSections: uniq(x.sidebarSections ?? d.sidebarSections, sidebarOrder), hiddenSidebarSections: uniq(x.hiddenSidebarSections ?? [], sidebarOrder), bottomItems: uniq(x.bottomItems ?? d.bottomItems, bottomOrder), hiddenBottomItems: uniq(x.hiddenBottomItems ?? [], bottomOrder), collapsedSections: uniq(x.collapsedSections ?? [], sidebarOrder), pagesTop: x.pagesTop === true, groupBy: ['project', 'folder', 'none'].includes(String(x.groupBy)) ? x.groupBy as GroupBy : 'project' };
}
export function moveItem<T extends string>(items: T[], item: T, delta: -1 | 1): T[] { const i = items.indexOf(item); const j = i + delta; if (i < 0 || j < 0 || j >= items.length) return items; const out = [...items]; [out[i], out[j]] = [out[j], out[i]]; return out }
export function hideItem<T extends string>(items: T[], hidden: T[], item: T) { return { items: items.filter((x) => x !== item), hidden: uniq([...hidden, item], items.concat(hidden)) } }
export function validateTags(tags: string[]): string[] { const clean = [...new Set(tags.map((x) => x.trim().replace(/^#/, '')).filter((x) => x && x.length <= 40 && !/\s/.test(x)))]; if (clean.length > 20) throw new Error('a thread can have at most 20 tags'); return clean }
export function validateFolder(f: Folder): Folder { if (!f.name.trim() || f.name.length > 80) throw new Error('folder name must be 1-80 characters'); if ('parentId' in f && f.parentId !== undefined) throw new Error('folders cannot nest'); return { id: f.id, name: f.name.trim(), visibility: f.visibility } }
export function sidebarGroups(threads: ThreadNav[], folders: Folder[], groupBy: GroupBy) {
  const captains = threads.filter((t) => t.kind === 'captain'); const pinned = threads.filter((t) => t.pinned);
  const normal = threads.filter((t) => t.kind !== 'captain');
  const key = (t: ThreadNav) => groupBy === 'project' ? `Project: ${t.project}` : groupBy === 'folder' ? (t.folderId ? `Folder: ${folders.find((f) => f.id === t.folderId)?.name ?? t.folderId}` : 'Folder: None') : 'Threads';
  const groups = new Map<string, ThreadNav[]>(); for (const t of normal) { const k = key(t); groups.set(k, [...(groups.get(k) ?? []), t]) }
  return { captains, pinned, folders, groups: [...groups].map(([label, items]) => ({ label, items })) };
}
export function filterCommands(items: CommandItem[], query: string, category: CommandCategory | 'all'): CommandItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((x) => (category === 'all' || x.category === category) && (!q || [x.title, x.path, ...(x.keywords ?? [])].join(' ').toLowerCase().includes(q)));
}

export const threadPaneTabs = ['overview','diffs','files','setup','browser','desktop','shell','prs','subagents','phones'] as const;
export type ThreadPaneTab = (typeof threadPaneTabs)[number];
export type ThreadFilter = { query?: string; tag?: string; folderId?: string | null; project?: string };
export type SavedView = { id: string; name: string; filter: ThreadFilter };
export function filterThreads(threads: ThreadNav[], filter: ThreadFilter): ThreadNav[] {
  const q = filter.query?.trim().toLowerCase();
  return threads.filter((t) => (!q || t.title.toLowerCase().includes(q)) && (!filter.tag || t.tags.includes(filter.tag)) && (filter.folderId === undefined || t.folderId === filter.folderId) && (!filter.project || t.project === filter.project));
}
export function saveView(views: SavedView[], view: SavedView): SavedView[] { if (!view.name.trim()) throw new Error('saved view needs a name'); return [...views.filter((x) => x.id !== view.id), view] }

export function closeTabs(tabs: Tab[], id: string, mode: 'self' | 'others' | 'right' | 'all'): Tab[] {
  const i = tabs.findIndex((t) => t.id === id); if (i < 0) return tabs;
  return tabs.map((t, n) => ({ ...t, closed: t.closed || (mode === 'all' || (mode === 'self' && n === i) || (mode === 'others' && n !== i) || (mode === 'right' && n > i)) }));
}
export function reopenClosed(tabs: Tab[]): Tab[] { const i = tabs.map((t) => t.closed).lastIndexOf(true); return i < 0 ? tabs : tabs.map((t, n) => n === i ? { ...t, closed: false } : t) }
export function middleClickClose(tabs: Tab[], id: string, button: number): Tab[] { return button === 1 ? closeTabs(tabs, id, 'self') : tabs }
export function moveOnFromPreview(tabs: Tab[], activeId: string): Tab[] { return tabs.map((t) => ({ ...t, closed: t.closed || (t.preview && t.id !== activeId) })) }
export function keepPreviewTab(tabs: Tab[], id: string): Tab[] { return tabs.map((t) => t.id === id ? { ...t, preview: false } : t) }
export function splitPane(panes: Pane[], id: string, direction: 'right' | 'down'): Pane[] { const p = panes.find((x) => x.id === id); if (!p) return panes; return [...panes, { id: `${id}-${direction}`, direction, tabs: [] }] }
export type OnboardingState = { steps: string[]; done: string[]; role: 'creator' | 'joiner' };
export function onboardingSteps(role: 'creator' | 'joiner'): string[] { return role === 'creator' ? ['org-setup', 'connect-model', 'first-project', 'first-thread'] : ['connect-model', 'first-thread'] }
export function completeOnboardingStep(state: OnboardingState, step: string): OnboardingState { return state.steps.includes(step) && !state.done.includes(step) ? { ...state, done: [...state.done, step] } : state }
export function loadJson<T>(key: string, fallback: T, storage?: Pick<Storage, 'getItem'>): T { try { const raw = (storage ?? globalThis.localStorage)?.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback } }
export function saveJson(key: string, value: unknown, storage?: Pick<Storage, 'setItem'>) { try { (storage ?? globalThis.localStorage)?.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ } }
