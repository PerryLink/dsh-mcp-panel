/**
 * Sanitizer tests: URL query credentials, userinfo passwords, header values,
 * bearer tokens, JWTs, embedded URLs, and extreme inputs. Every case asserts
 * the credential is gone while benign content survives.
 *
 * @module dsh-mcp-panel/test/sanitize.spec
 */

import { describe, expect, it } from 'vitest'
import { sanitizeError, sanitizeText, sanitizeUrl } from '../src/sanitize.ts'

describe('sanitizeUrl', () => {
  it('redacts credential query values and keeps benign pairs', () => {
    expect(sanitizeUrl('https://example.com/mcp?token=abc&x=1')).toBe('https://example.com/mcp?token=***&x=1')
  })

  it('redacts the userinfo password but keeps the username', () => {
    expect(sanitizeUrl('https://user:pass@example.com/mcp')).toBe('https://user:***@example.com/mcp')
  })

  it('redacts encoded credential keys (URLSearchParams decodes them first)', () => {
    expect(sanitizeUrl('https://example.com/?%74oken=abc%2Fdef')).toBe('https://example.com/?token=***')
  })

  it('redacts access_token / apikey / api_key variants case-insensitively', () => {
    expect(sanitizeUrl('HTTPS://EXAMPLE.COM/?ACCESS_TOKEN=ABC&ok=2#frag')).toBe('https://example.com/?ACCESS_TOKEN=***&ok=2#frag')
    expect(sanitizeUrl('http://[::1]:3000/mcp?apikey=zzz&api_key=yyy')).toBe('http://[::1]:3000/mcp?apikey=***&api_key=***')
  })

  it('keeps non-credential query pairs intact', () => {
    expect(sanitizeUrl('https://example.com/mcp?server=github&page=2')).toBe('https://example.com/mcp?server=github&page=2')
  })

  it('handles unparseable inputs with the pattern fallback without throwing', () => {
    const fallback = sanitizeUrl('://bad url?token=SECRET')
    expect(fallback).not.toContain('SECRET')
    expect(sanitizeUrl('http://user:secret@host/path?key=value&ok=1')).toBe('http://user:***@host/path?key=***&ok=1')
  })

  it('tolerates empty and credential-free URLs', () => {
    expect(sanitizeUrl('')).toBe('')
    expect(sanitizeUrl('https://example.com/')).toBe('https://example.com/')
  })
})

describe('sanitizeText', () => {
  it('redacts Authorization/Bearer headers including JWTs', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U failed'
    const result = sanitizeText(text)
    expect(result).not.toContain('eyJhbGci')
    expect(result).toContain('Authorization: ***')
  })

  it('redacts lowercase bearer tokens', () => {
    expect(sanitizeText('err: bearer abcDEF123.token')).toBe('err: bearer ***')
  })

  it('redacts header-shaped key=value credentials', () => {
    const result = sanitizeText('failed with headers {authorization: "Basic Zm9vOmJhcg=="} and x-api-key: KEY123')
    expect(result).not.toContain('Zm9vOmJhcg==')
    expect(result).not.toContain('KEY123')
    expect(result).toContain('x-api-key: ***')
  })

  it('redacts embedded URL query credentials inside error text', () => {
    const result = sanitizeText('fetch failed for http://x/?token=SECRET&ok=1 while connecting')
    expect(result).not.toContain('SECRET')
    expect(result).toContain('token=***')
  })

  it('redacts quoted JSON-ish token values', () => {
    const result = sanitizeText('{"error":"bad token"} token: "abc123"')
    expect(result).not.toContain('abc123')
  })

  it('redacts bare JWTs anywhere in the text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    expect(sanitizeText(`jwt=${jwt}`)).not.toContain('eyJhbGci')
  })

  it('keeps benign prose intact', () => {
    const text = 'connection attempt failed: ECONNREFUSED 127.0.0.1:3000'
    expect(sanitizeText(text)).toBe(text)
  })
})

describe('sanitizeError', () => {
  it('stringifies thrown values safely and redacts credentials', () => {
    expect(sanitizeError(new Error('401 with token=SECRET'))).not.toContain('SECRET')
    expect(sanitizeError('plain failure')).toBe('plain failure')
    expect(sanitizeError(undefined)).toBe('undefined')
    expect(sanitizeError(null)).toBe('null')
    expect(sanitizeError({ toString: 1 })).toBe('<unrenderable error>')
  })
})
