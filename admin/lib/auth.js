// Settings and PAT management. Shared across all admin tools.
//
// localStorage key is `licAdminSettings`. A legacy key
// `lic_admin_settings` (used by the Post Generator) is auto-migrated
// on first read.
//
// Shape:
//   {
//     githubToken: string,
//     repoOwner: string,
//     repoName: string,
//     branch: string,
//     committerName: string,
//     committerEmail: string,
//     rememberToken: boolean
//   }
//
// If `rememberToken` is false, saveSettings() persists everything
// EXCEPT the token (so it stays in the current-page form state but
// isn't written to localStorage).

import { CONFIG } from './config.js';

const STORAGE_KEY = 'licAdminSettings';
const LEGACY_KEY = 'lic_admin_settings';

const DEFAULTS = Object.freeze({
  githubToken: '',
  repoOwner: CONFIG.repo.owner,
  repoName: CONFIG.repo.name,
  branch: CONFIG.repo.branch,
  committerName: '',
  committerEmail: '',
  rememberToken: false,
});

export function getSettings() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
      raw = legacy;
    }
  }
  if (raw) {
    try { return { ...DEFAULTS, ...JSON.parse(raw) }; } catch { /* fall through */ }
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings) {
  const toSave = settings.rememberToken
    ? settings
    : { ...settings, githubToken: '' };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
}

// Convenience: return only the GitHub credentials block that
// `admin/lib/github.js` wants.
export function getGitHubCreds() {
  const s = getSettings();
  return {
    token: s.githubToken,
    owner: s.repoOwner || CONFIG.repo.owner,
    name: s.repoName || CONFIG.repo.name,
    branch: s.branch || CONFIG.repo.branch,
  };
}
