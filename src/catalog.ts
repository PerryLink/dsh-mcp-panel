/**
 * The community MCP server catalog: a built-in recommended directory plus a
 * user-editable overlay (append new entries, override by id). Entries carry
 * only non-secret facts — recommended env/header VARIABLE NAMES are surfaced
 * as keys, never values, so the panel can prompt for credentials without ever
 * shipping one. Pure module: no I/O, no registry reads.
 *
 * @module dsh-mcp-panel/catalog
 */

import type { McpServerConfigInput } from './patch.ts'

/** Schema discriminator of the catalog document (version 1). */
export const CATALOG_SCHEMA = 'dsh-mcp-panel/catalog@v1' as const

/** The `serverName` contract the official client enforces (`[A-Za-z0-9_-]{1,32}`). */
const CATALOG_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/u

/** One recommended MCP server entry. The `id` doubles as the `serverName`. */
export interface CatalogEntry {
  /** Stable slug, also the `serverName` (`[A-Za-z0-9_-]{1,32}`). */
  id: string
  /** Display name. */
  name: string
  /** One-line description of what the server provides. */
  description: string
  /** Declared transport. */
  transport: 'stdio' | 'streamable-http'
  /** stdio: executable + args (no shell interpretation). */
  command?: string
  /** stdio: argument list. */
  args?: string[]
  /** streamable-http: endpoint URL. */
  url?: string
  /** Recommended env variable names (values are user-supplied, never shipped). */
  envKeys?: string[]
  /** Recommended header names (values are user-supplied, never shipped). */
  headerKeys?: string[]
  /** Discovery tags. */
  tags?: string[]
}

/**
 * The built-in recommended directory. Generic public MCP servers only — no
 * credentials, no private endpoints. `envKeys` name the variables a user must
 * supply (e.g. a GitHub token), never the values.
 */
export const DEFAULT_CATALOG: readonly CatalogEntry[] = Object.freeze([
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read and write files through a local filesystem MCP server.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    tags: ['files', 'official'],
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Git repository operations (status, diff, log, branches).',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-git'],
    tags: ['git', 'vcs'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub issues, PRs, repos, and search.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envKeys: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    tags: ['github', 'official'],
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetch and convert web pages to Markdown.',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    tags: ['web', 'official'],
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Browser automation and page interaction.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    tags: ['browser'],
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Structured, step-by-step reasoning.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    tags: ['reasoning', 'official'],
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'A knowledge-graph memory store.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    tags: ['memory', 'official'],
  },
])

/**
 * Merge the built-in directory with a user overlay: entries keyed by `id`;
 * the user's entry REPLACES a built-in one with the same id, and appends when
 * the id is new. Returns entries in first-seen order (built-in order first,
 * then appended user entries).
 * @param builtin - the shipped directory.
 * @param user - the user overlay (append/override).
 * @returns the merged directory.
 */
export function mergeCatalog(builtin: readonly CatalogEntry[], user: readonly CatalogEntry[]): CatalogEntry[] {
  const order: string[] = []
  const byId = new Map<string, CatalogEntry>()
  for (const entry of builtin) {
    if (!byId.has(entry.id)) order.push(entry.id)
    byId.set(entry.id, entry)
  }
  for (const entry of user) {
    if (!byId.has(entry.id)) order.push(entry.id)
    byId.set(entry.id, entry)
  }
  return order.map(id => byId.get(id)!)
}

/** Validation problem for one catalog entry. */
export interface CatalogIssue {
  /** Field path, e.g. `catalog[2].command`. */
  field: string
  /** English explanation. */
  text: string
}

/**
 * Validate a raw catalog entry (untrusted JSON from config). A legal entry has
 * a slug id, a name, a description, a legal transport, and the transport's
 * required field (`command` for stdio, `url` for streamable-http).
 * @param value - the raw entry.
 * @param index - its position in the overlay, for error messages.
 * @returns issues (empty when valid).
 */
export function catalogIssues(value: unknown, index: number): CatalogIssue[] {
  const issues: CatalogIssue[] = []
  const field = (name: string): string => `catalog[${index}].${name}`
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [{ field: `catalog[${index}]`, text: 'catalog entry must be a JSON object' }]
  }
  const entry = value as Record<string, unknown>
  if (typeof entry['id'] !== 'string' || !CATALOG_ID_PATTERN.test(entry['id'])) {
    issues.push({ field: field('id'), text: `id must match ${CATALOG_ID_PATTERN.source} and double as the serverName` })
  }
  if (typeof entry['name'] !== 'string' || entry['name'].trim() === '') {
    issues.push({ field: field('name'), text: 'name must be a non-empty string' })
  }
  if (typeof entry['description'] !== 'string' || entry['description'].trim() === '') {
    issues.push({ field: field('description'), text: 'description must be a non-empty string' })
  }
  if (entry['transport'] !== 'stdio' && entry['transport'] !== 'streamable-http') {
    issues.push({ field: field('transport'), text: 'transport must be "stdio" or "streamable-http"' })
  }
  if (entry['transport'] === 'stdio' && (typeof entry['command'] !== 'string' || entry['command'].trim() === '')) {
    issues.push({ field: field('command'), text: 'stdio entries require a command' })
  }
  if (entry['transport'] === 'streamable-http') {
    const url = entry['url']
    if (typeof url !== 'string' || url === '') {
      issues.push({ field: field('url'), text: 'streamable-http entries require a url' })
    } else {
      try {
        new URL(url)
      } catch {
        issues.push({ field: field('url'), text: 'url must be an absolute URL' })
      }
    }
  }
  const checkKeys = (candidate: unknown, name: string): void => {
    if (candidate === undefined) return
    if (!Array.isArray(candidate) || candidate.some(key => typeof key !== 'string' || key.trim() === '')) {
      issues.push({ field: field(name), text: `${name} must be an array of non-empty strings` })
    }
  }
  checkKeys(entry['args'], 'args')
  checkKeys(entry['envKeys'], 'envKeys')
  checkKeys(entry['headerKeys'], 'headerKeys')
  checkKeys(entry['tags'], 'tags')
  return issues
}

/** Validate a whole overlay; returns the issues of every malformed entry. */
export function catalogOverlayIssues(value: unknown): CatalogIssue[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) return [{ field: 'catalog', text: 'catalogEntries must be an array of entries' }]
  return value.flatMap((entry, index) => catalogIssues(entry, index))
}

/**
 * Normalize one validated catalog entry into an editor `add` config input.
 * The entry `id` becomes the `serverName`; env/header VALUES are never
 * synthesized — only the recommended variable names are surfaced.
 * @param entry - the catalog entry.
 * @returns the config input ready for a one-click `add` patch.
 */
export function catalogToConfigInput(entry: CatalogEntry): McpServerConfigInput {
  return {
    serverName: entry.id,
    transport: entry.transport,
    ...(entry.transport === 'stdio' && entry.command !== undefined ? { command: entry.command } : {}),
    ...(entry.transport === 'stdio' && entry.args !== undefined && entry.args.length > 0 ? { args: [...entry.args] } : {}),
    ...(entry.transport === 'streamable-http' && entry.url !== undefined ? { url: entry.url } : {}),
  }
}
