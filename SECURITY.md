# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, never in a public issue:

1. Use GitHub's **private vulnerability reporting** on the
   [Security tab](https://github.com/PerryLink/dsh-mcp-panel/security) of this repository
   (Advisories → "Report a vulnerability"). It keeps the report confidential and gives us a
   structured channel to coordinate the fix.
2. If that channel is unavailable, contact the repository owner through their GitHub profile.

**Sanitize before reporting:** redact all tokens, keys, request headers, JWTs, and other
credentials from logs, screenshots, and reproduction steps. The plugin's display layer
redacts credentials, but your report is a new channel — re-check it yourself.

Please include:

- affected version(s)
- a description of the issue and its impact
- minimal reproduction steps, if you have them
- whether you believe the issue is already publicly exploitable

## What to expect

- We acknowledge reports within **7 days** (usually much faster).
- You stay informed while a fix is prepared and published as a patch release.
- Public disclosure happens **after** the fix is released, unless you and the maintainers
  agree otherwise.
- With your permission, you are credited in the release notes and the security advisory.

## Scope

This policy covers the `dsh-mcp-panel` repository and the npm package `dsh-mcp-panel`.
Issues in DeepSeek Harness itself should be reported to
[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) instead.

## Supported versions

The latest published release (currently the 0.5.x line) receives security fixes.
