import type { Project as CoreProject } from '@flotilla/core/types';

export type ProjectVisibility = 'private' | 'shared';
export type ProjectRepoRole = 'primary' | 'lazy';
export type ProjectRepoProvider = 'github' | 'git' | 'local';
export interface ProjectRepository {
  id: string;
  provider: ProjectRepoProvider;
  fullName: string;          // github `owner/repo`, an https/file git URL, or an absolute folder path
  baseBranch: string;
  role: ProjectRepoRole;     // primary: mirrored at creation and seeded into every thread; lazy: mirrored on demand
  machineId: string | null;  // folder source on a paired device; null = the server host
  description: string | null;
  clonedAt: string | null;
}
export interface ProjectIdentity { name: string; icon: string | null; code: string }
export type ProjectSource =
  | { kind: 'github'; fullName: string; baseBranch?: string }
  | { kind: 'git-url'; url: string; baseBranch?: string }
  | { kind: 'folder'; path: string; machineId?: string | null; baseBranch?: string }
  | { kind: 'empty' };
export interface Project extends ProjectIdentity, Omit<CoreProject, 'repo' | 'name'> {
  repo: Pick<ProjectRepository, 'provider' | 'fullName' | 'baseBranch'> | null;   // the primary repository (seeded by the runner); null = repoless
  repos: ProjectRepository[];
  source: ProjectSource | null;
  visibility: ProjectVisibility;
}
export interface RepoSuggestion { fullName: string; defaultBranch: string; private: boolean; pushedAt: string }
