// admin/lib/bootstrap.js
// One-stop attachment of lib helpers to window.LIB so the classic-script
// admin tools (which use inline `LiCAdmin` IIFEs and inline onclick
// handlers) can delegate to the shared library with a single tag:
//
//   <script type="module" src="/admin/lib/bootstrap.js"></script>
//
// Anything attached here is available as `window.LIB.<name>` from the
// classic script. Module scripts run after HTML parsing, before
// DOMContentLoaded — so by the time any user interaction (or any
// `window.addEventListener('DOMContentLoaded', ...)` fires), the lib
// is ready.
//
// `window.LIB.api()` is a convenience factory: it builds a fresh
// GitHubAPI instance from the current settings each call. Settings can
// change mid-session (token re-entered, repo switched), so don't cache.

import { CONFIG, photonUrl } from './config.js';
import { getSettings, saveSettings, clearSettings, getGitHubCreds } from './auth.js';
import { GitHubAPI } from './github.js';
import {
  encode as b64encode, decode as b64decode,
  bytesToBase64, base64ToBytes, fileToBase64,
} from './base64.js';
import {
  slugify, formatDate, postPath, postUrl, isoDate, yearMonth,
} from './slug.js';
import * as database from './database.js';

window.LIB = Object.assign(window.LIB || {}, {
  CONFIG,
  photonUrl,
  getSettings, saveSettings, clearSettings, getGitHubCreds,
  GitHubAPI,
  api: () => new GitHubAPI(getGitHubCreds()),
  b64encode, b64decode,
  bytesToBase64, base64ToBytes, fileToBase64,
  slugify, formatDate, postPath, postUrl, isoDate, yearMonth,
  database,
});
