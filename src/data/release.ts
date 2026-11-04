// Typed access to src/data/release.json (written by scripts/sync-release.mjs at deploy time).
import raw from './release.json';
import { WEBSITE_REPO } from '../../site.config.mjs';

export interface Edition {
  id: string;
  file: string;
  available: boolean;
  url?: string;
  size?: number;
  sha256?: string;
  version?: string;
  preview?: boolean;
  immutable?: boolean;
  published?: string;
  releaseUrl?: string;
}

export interface ReleaseState {
  status: 'available' | 'unreleased';
  version: string | null;
  repo: {
    name: string;
    public: boolean;
    url: string | null;
    issues?: string | null;
    license: { spdx: string; name: string; url: string } | null;
  };
  editions: Edition[];
  releases: { version: string; url: string; published: string; preview: boolean }[];
  published: string | null;
  notesUrl: string | null;
}

export const release = raw as ReleaseState;
export const mac = release.editions.find((e) => e.id === 'macos-apple-silicon')!;
export const universal = release.editions.find((e) => e.id === 'macos-universal')!;
export const windows = release.editions.find((e) => e.id === 'windows-x64')!;
export const isReleased = mac.available;
export const sourcePublic = release.repo.public && Boolean(release.repo.url);
export const websiteRepoUrl = `https://github.com/${WEBSITE_REPO}`;
/** Where people report problems: the app's issue tracker once it is public, else the website's. */
export const issuesUrl = release.repo.issues ?? `${websiteRepoUrl}/issues`;
export const releasesUrl = sourcePublic ? `${release.repo.url}/releases` : null;

export function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / 1_000_000;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}
