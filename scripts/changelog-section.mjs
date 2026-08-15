#!/usr/bin/env node
/**
 * Print one version's CHANGELOG section to stdout (heading excluded from the
 * input requirement, everything until the next `## [` heading included).
 * Used by the release workflow to build the GitHub Release body and easy to
 * reuse for backfilled release notes.
 *
 * Usage: node scripts/changelog-section.mjs <version>
 *
 * @module dsh-mcp-panel/scripts/changelog-section
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error(`usage: node scripts/changelog-section.mjs <x.y.z> (got: ${version ?? 'none'})`)
  process.exit(1)
}

const changelog = readFileSync(resolve(import.meta.dirname, '..', 'CHANGELOG.md'), 'utf8')
const lines = changelog.split('\n')
const start = lines.findIndex(line => line === `## [${version}]`)
if (start === -1) {
  console.error(`CHANGELOG.md has no "## [${version}]" section`)
  process.exit(1)
}
const end = lines.findIndex((line, index) => index > start && line.startsWith('## ['))
const section = lines.slice(start, end === -1 ? undefined : end)
process.stdout.write(`${section.join('\n').replace(/\n+$/, '')}\n`)
