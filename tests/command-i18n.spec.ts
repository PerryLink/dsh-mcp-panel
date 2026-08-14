/**
 * `/mcp` output-language tests: the same snapshot renders in English
 * (default) and Simplified Chinese (`outputLanguage: 'zh'`), and the patch
 * suggestion line itself stays machine-identical across languages.
 *
 * @module dsh-mcp-panel/test/command-i18n.spec
 */

import { describe, expect, it } from 'vitest'
import { mcpRow, mountHarness, runCommand } from './harness.ts'

const GITHUB_CONFIG = {
  serverName: 'github',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
}

function text(result: unknown): string {
  return (result as { result?: { text?: string } }).result?.text ?? ''
}

describe('/mcp output language', () => {
  it('renders Simplified Chinese when configured', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)], { outputLanguage: 'zh' })
    const list = text(await runCommand(harness, '/mcp'))
    expect(list).toContain('MCP 服务器（1 个）：')
    expect(list).toContain('已启用')
    expect(list).toContain('状态: unknown (source: derived)')
    expect(list).toContain('最近错误: —')

    const suggestion = text(await runCommand(harness, '/mcp github disable'))
    expect(suggestion).toContain('要停用 "github"（条目 mcp-github）')
    expect(suggestion).toContain('本命令绝不修改你的配置')

    const usage = text(await runCommand(harness, '/mcp github tools extra'))
    expect(usage).toContain('用法：/mcp')
  })

  it('keeps the patch suggestion line machine-identical across languages', async () => {
    const en = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    const zh = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)], { outputLanguage: 'zh' })
    const enText = text(await runCommand(en, '/mcp github disable'))
    const zhText = text(await runCommand(zh, '/mcp github disable'))
    const patchLine = "- set: { id: mcp-github, name: '@deepseek-ai/dsh-mcp-client', disabled: true }"
    expect(enText).toContain(patchLine)
    expect(zhText).toContain(patchLine)
  })

  it('defaults to English output', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    const list = text(await runCommand(harness, '/mcp'))
    expect(list).toContain('MCP servers (1):')
  })
})
