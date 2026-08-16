/**
 * Profile patch-layer writes for the console. APPEND-ONLY by design: the
 * console never rewrites `cordis.patch.yml` — it appends one generated
 * operation block at a time, after copying the current file to a timestamped
 * backup. The Loader applies patch lists in order, so an appended operation
 * is the effective configuration; user comments and unrelated rows stay
 * byte-for-byte untouched. Backups are pruned to the newest `backupCount`.
 *
 * Every write is reversible: the backup restores the previous state, and an
 * appended block can be hand-removed to undo.
 *
 * @module dsh-mcp-panel/write
 */

import { readdir, copyFile, readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
/** Backup filename suffix: `<file>.bak-<epoch-ms>`. */
const BACKUP_SUFFIX = '.bak-'

/** Fresh-file header when the patch layer does not exist yet. */
const FRESH_FILE_HEADER = `# dsh-mcp-panel managed patch layer (created by the MCP console).
# Operations are APPEND-ONLY: the console never rewrites existing content.
[]
`

/**
 * Copy the current patch file to a timestamped backup, append one fragment,
 * and prune backups beyond `backupCount` (newest kept). Creates the file with
 * an empty list header when it does not exist.
 *
 * @param filePath - absolute path of the profile patch layer.
 * @param fragment - the generated YAML block (no trailing newline needed).
 * @param backupCount - backups retained (>= 1).
 * @returns the absolute backup path and the number of bytes appended.
 * @throws when any file operation fails; nothing is partially applied after
 *   the backup step (backup → append, in that order).
 */
export async function appendPatchFragment(
  filePath: string,
  fragment: string,
  backupCount: number,
): Promise<{ readonly backupPath: string; readonly bytes: number }> {
  let existing = true
  try {
    await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error
    existing = false
  }

  if (existing) {
    const backupPath = `${filePath}${BACKUP_SUFFIX}${Date.now()}`
    await copyFile(filePath, backupPath)
    const bytes = await appendFragment(filePath, fragment)
    await pruneBackups(filePath, backupCount)
    return { backupPath, bytes }
  }

  await writeFile(filePath, FRESH_FILE_HEADER, 'utf8')
  const backupPath = `${filePath}${BACKUP_SUFFIX}${Date.now()}`
  const bytes = await appendFragment(filePath, fragment)
  await pruneBackups(filePath, backupCount)
  return { backupPath, bytes }
}

/** Append one fragment with surrounding newlines, normalizing a trailing newline first. */
async function appendFragment(filePath: string, fragment: string): Promise<number> {
  const content = await readFile(filePath, 'utf8')
  const normalized = content.endsWith('\n') ? content : `${content}\n`
  const block = normalized.endsWith('\n\n') ? `${fragment}\n` : `\n${fragment}\n`
  await writeFile(filePath, `${normalized}${block}`, 'utf8')
  return Buffer.byteLength(block, 'utf8')
}

/** Keep only the newest `keep` `*.bak-*` siblings of `filePath`. */
async function pruneBackups(filePath: string, keep: number): Promise<void> {
  const dir = join(filePath, '..')
  const prefix = filePath.slice(dir.length + 1) + BACKUP_SUFFIX
  let names: string[]
  try {
    names = (await readdir(dir)).filter(name => name.startsWith(prefix))
  } catch {
    return // Directory listing failed — pruning is best-effort, never fatal.
  }
  if (names.length <= keep) return
  const sorted = names
    .map(name => ({ name, stamp: Number(name.slice(prefix.length)) }))
    .filter(entry => Number.isFinite(entry.stamp))
    .sort((left, right) => right.stamp - left.stamp)
  for (const entry of sorted.slice(keep)) {
    try {
      await unlink(join(dir, entry.name))
    } catch {
      // A busy backup file only skips pruning.
    }
  }
}
