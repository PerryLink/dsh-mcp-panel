/**
 * Profile-write tests: append-only patches, timestamped backups, fresh-file
 * creation, and backup pruning — all against a real temp directory.
 *
 * @module dsh-mcp-panel/test/write.spec
 */

import { mkdtemp, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { appendPatchFragment } from '../src/write.ts'

const FRAGMENT = "- insert:\n    - id: mcp-x\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: x\n        transport: stdio\n        command: npx\n"

const dirs: string[] = []
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-mcp-panel-write-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    try {
      for (const name of await readdir(dir)) await unlink(join(dir, name))
      await rmdir(dir)
    } catch {
      // Best-effort cleanup only.
    }
  }
})

describe('appendPatchFragment', () => {
  it('creates a fresh patch file with a header and a backup', async () => {
    const dir = await tempDir()
    const file = join(dir, 'cordis.patch.yml')
    const { backupPath, bytes } = await appendPatchFragment(file, FRAGMENT, 5)
    const content = await readFile(file, 'utf8')
    expect(content).toContain('# dsh-mcp-panel managed patch layer')
    expect(content).toContain('- insert:')
    expect(content).toContain("serverName: x")
    expect(bytes).toBeGreaterThan(0)
    expect(backupPath.startsWith(`${file}.bak-`)).toBe(true)
  })

  it('never rewrites existing content: appends after it, byte-for-byte', async () => {
    const dir = await tempDir()
    const file = join(dir, 'cordis.patch.yml')
    const original = `# my hand-written comment\n- insert:\n    - id: keep\n      name: x\n`
    await writeFile(file, original, 'utf8')
    await appendPatchFragment(file, FRAGMENT, 5)
    const content = await readFile(file, 'utf8')
    expect(content.startsWith(original)).toBe(true)
    expect(content).toContain('mcp-x')
    // YAML list shape stays valid: two top-level `- insert:` blocks.
    expect(content.match(/- insert:/g)).toHaveLength(2)
  })

  it('prunes backups beyond the retention count (newest kept)', async () => {
    const dir = await tempDir()
    const file = join(dir, 'cordis.patch.yml')
    await writeFile(file, '[]\n', 'utf8')
    for (let index = 0; index < 7; index += 1) {
      // Staggered writes produce distinct timestamps on fast machines too.
      await new Promise(resolve => { setTimeout(resolve, 5) })
      await appendPatchFragment(file, FRAGMENT, 3)
    }
    const backups = (await readdir(dir)).filter(name => name.startsWith('cordis.patch.yml.bak-'))
    expect(backups.length).toBe(3)
  })
})
