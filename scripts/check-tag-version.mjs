#!/usr/bin/env node
/**
 * Release-gate helper: fail unless the pushed tag names the package version.
 * The release workflow passes the GitHub ref (e.g. `v0.3.0`); any mismatch
 * aborts before publish, so a wrongly tagged commit can never reach npm.
 *
 * Usage: node scripts/check-tag-version.mjs <ref>  (ref like `v0.3.0`)
 *
 * @module dsh-mcp-panel/scripts/check-tag-version
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ref = process.argv[2] ?? ''
const expected = ref.startsWith('v') ? ref.slice(1) : null
if (expected === null || !/^\d+\.\d+\.\d+$/.test(expected)) {
  console.error(`usage: node scripts/check-tag-version.mjs v<x.y.z> (got: ${ref || 'none'})`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8'))
if (pkg.version !== expected) {
  console.error(`tag ${ref} does not match package.json version ${pkg.version}; refusing to publish`)
  process.exit(1)
}
console.log(`tag ${ref} matches package.json version ${pkg.version}`)
