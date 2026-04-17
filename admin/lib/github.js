// Minimal GitHub REST API client for admin tools.
// - Bearer authentication (new token format; replaces deprecated `token <PAT>`)
// - Retry with exponential backoff on secondary rate limit / 5xx
// - Handles 204 No Content (workflow_dispatch returns that)
// - commitFiles() does a batch write via the git data API in one commit
//
// The 10 existing admin tools each have their own inline copy of similar
// logic; migrating them to this shared module is part of M1.

import { encode as b64encode } from './base64.js';

const SECONDARY_RATE_LIMIT_PAUSE_MS = 60_000;
const DEFAULT_RETRIES = 4;

export class GitHubAPI {
  constructor({ token, owner, name, branch = 'main' }) {
    if (!token) throw new Error('GitHubAPI: token required');
    this.token = token;
    this.owner = owner;
    this.name = name;
    this.branch = branch;
  }

  async request(endpoint, options = {}, attempt = 0) {
    const url = `https://api.github.com${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (res.status === 204) return null;

    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const wait = Math.max(reset - Date.now(), SECONDARY_RATE_LIMIT_PAUSE_MS);
      if (attempt >= DEFAULT_RETRIES) throw new Error(`Rate limited, giving up after ${attempt} retries`);
      await sleep(wait);
      return this.request(endpoint, options, attempt + 1);
    }

    if (res.status >= 500 && attempt < DEFAULT_RETRIES) {
      await sleep(1000 * 2 ** attempt);
      return this.request(endpoint, options, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status} ${res.statusText}: ${text}`);
    }

    return res.json();
  }

  // Repo contents API — good for individual file reads/writes. Size-limited.
  getFile(path) {
    return this.request(`/repos/${this.owner}/${this.name}/contents/${path}?ref=${this.branch}`);
  }

  deleteFile(path, sha, message) {
    return this.request(`/repos/${this.owner}/${this.name}/contents/${path}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: this.branch }),
    });
  }

  // Git data API — use for batch operations (many files in one commit).
  getRef() {
    return this.request(`/repos/${this.owner}/${this.name}/git/ref/heads/${this.branch}`);
  }

  getCommit(sha) {
    return this.request(`/repos/${this.owner}/${this.name}/git/commits/${sha}`);
  }

  getTree(treeSha, recursive = false) {
    const r = recursive ? '?recursive=1' : '';
    return this.request(`/repos/${this.owner}/${this.name}/git/trees/${treeSha}${r}`);
  }

  createTree(baseTreeSha, changes) {
    return this.request(`/repos/${this.owner}/${this.name}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: changes }),
    });
  }

  createCommit(message, treeSha, parentShas) {
    return this.request(`/repos/${this.owner}/${this.name}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: treeSha, parents: parentShas }),
    });
  }

  updateRef(commitSha) {
    return this.request(`/repos/${this.owner}/${this.name}/git/refs/heads/${this.branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitSha, force: false }),
    });
  }

  dispatchWorkflow(workflowFile, inputs) {
    return this.request(
      `/repos/${this.owner}/${this.name}/actions/workflows/${workflowFile}/dispatches`,
      { method: 'POST', body: JSON.stringify({ ref: this.branch, inputs }) },
    );
  }

  // Create a blob from a string (UTF-8) or a Uint8Array. Returns { sha, url }.
  async createBlob(content) {
    let b64;
    if (typeof content === 'string') {
      b64 = b64encode(content);
    } else if (content instanceof Uint8Array) {
      const { bytesToBase64 } = await import('./base64.js');
      b64 = bytesToBase64(content);
    } else {
      throw new Error('createBlob: content must be a string or Uint8Array');
    }
    return this.request(`/repos/${this.owner}/${this.name}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: b64, encoding: 'base64' }),
    });
  }

  // High-level batch commit. Creates one commit that adds/updates/deletes
  // every file in `files`. Use this for post-generator-style operations
  // that touch the homepage, month archive, year archive, category and
  // tag archives, author archive, RSS, and database shards all at once.
  //
  // files: Array<{ path: string, content: string|Uint8Array|null }>
  //   - content string → stored as UTF-8
  //   - content Uint8Array → stored as binary
  //   - content null → deletion
  //
  // Retries up to `retries` times on 5xx / secondary rate limits.
  async commitFiles(files, message, { retries = 2 } = {}) {
    if (!files || files.length === 0) throw new Error('commitFiles: empty file list');

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this._commitFilesOnce(files, message);
      } catch (err) {
        lastErr = err;
        // 409/422 are non-retryable (conflict / payload invalid)
        if (/\b(409|422)\b/.test(err.message)) throw err;
        if (attempt === retries) throw err;
        await sleep(1000 * 2 ** attempt);
      }
    }
    throw lastErr;
  }

  async _commitFilesOnce(files, message) {
    const ref = await this.getRef();
    const parentCommitSha = ref.object.sha;
    const parentCommit = await this.getCommit(parentCommitSha);
    const baseTreeSha = parentCommit.tree.sha;

    const treeEntries = await Promise.all(files.map(async (f) => {
      if (f.content === null || f.content === undefined) {
        return { path: f.path, mode: '100644', type: 'blob', sha: null };
      }
      const blob = await this.createBlob(f.content);
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));

    const newTree = await this.createTree(baseTreeSha, treeEntries);
    const newCommit = await this.createCommit(message, newTree.sha, [parentCommitSha]);
    return this.updateRef(newCommit.sha);
  }

  // Fetch a file's content as a UTF-8 string. Returns null on 404.
  async getFileContent(path) {
    let meta;
    try {
      meta = await this.getFile(path);
    } catch (err) {
      if (/\b404\b/.test(err.message)) return null;
      throw err;
    }
    if (!meta?.content) return null;
    const { decode } = await import('./base64.js');
    return decode(meta.content.replace(/\n/g, ''));
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
