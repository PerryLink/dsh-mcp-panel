#!/usr/bin/env python3
"""Generate README image assets for dsh-mcp-panel (docs/assets/).

Outputs (idempotent overwrite):
  dsh-mcp-panel-flow-light.svg / dsh-mcp-panel-flow-dark.svg
      Hero architecture diagram. Two hand-written SVG files (vector -- never
      rasterized to webp). Text inside is command-surface tokens only
      (cordis.patch.yml, mcp/status, /mcp, mcpPanel, ...), so all five README
      languages share the same pair.

The old single-version assets (dsh-mcp-panel-flow.svg, -hero.png, -demo.*)
are intentionally kept on disk so existing external links do not 404; the
READMEs reference the new light/dark pair.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow (only for the CJK font probe / future raster charts)
"""
from __future__ import annotations

import os
import sys

from PIL import ImageFont  # noqa: F401  (probe import kept from the family template)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# --- palette: PerryLink family accent + GitHub page backgrounds -------------
FAMILY = "#4B67B4"   # family accent (badges use labelColor #2B3245)
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
SKIN = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e"),
}

# --- CJK font probe: abort loudly instead of rendering tofu boxes -----------
# The flow diagram below is pure SVG (the viewer renders its text), but the
# family template keeps this probe so a future raster chart cannot silently
# render Chinese as boxes.
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",      # Microsoft YaHei
    r"C:\Windows\Fonts\simhei.ttf",    # SimHei
    r"C:\Windows\Fonts\Deng.ttf",      # DengXian
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
]
FONT_PATH = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
if FONT_PATH is None:
    sys.exit("FATAL: no CJK font found (looked for msyh.ttc, simhei.ttf, "
             "Deng.ttf, Noto Sans CJK, PingFang). Refusing to render Chinese "
             "as tofu boxes; install one of the probed fonts and re-run.")


def font(size: int):
    return ImageFont.truetype(FONT_PATH, size)


# ---------------------------------------------------------------------------
# Hero architecture SVG (light + dark)
#   profile patch -> mcp-client (bridge) -> mcp/status -> console -> patch write
#   read path is the status seam, write path goes back to the profile patch.
# ---------------------------------------------------------------------------
NODES = [
    ("cordis.patch.yml", "1 row / server"),
    ("mcp-client", "bridge · mcp__*"),
    ("mcp/status", "observed only"),
    ("dsh-mcp-panel", "/mcp · MCP tab"),
    ("patch write", "approval · backup"),
]


def flow_svg(skin: str) -> str:
    s = SKIN[skin]
    w, h = 1200, 430
    nw, nh, gap = 180, 96, 45
    y0 = 150
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}" role="img" aria-label="dsh-mcp-panel console '
        f'flow">',
        '<title>dsh-mcp-panel console flow</title>',
        f'<rect width="{w}" height="{h}" rx="18" fill="{s["bg"]}"/>',
        f'<text x="60" y="58" fill="{s["text"]}" font-family="ui-sans-serif,'
        f'system-ui,sans-serif" font-size="30" font-weight="700">'
        f'dsh-mcp-panel</text>',
        f'<text x="60" y="92" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="16">mcp/status · mcpPanel · '
        f'cordis.patch.yml</text>',
        f'<line x1="60" y1="118" x2="1140" y2="118" stroke="{s["border"]}"/>',
    ]
    for i, (label, sub) in enumerate(NODES):
        x = 60 + i * (nw + gap)
        accent = GREEN[skin] if i == len(NODES) - 1 else (
            FAMILY if i in (0, 3) else s["border"])
        parts.append(
            f'<rect x="{x}" y="{y0}" width="{nw}" height="{nh}" rx="14" '
            f'fill="{s["box"]}" stroke="{accent}" stroke-width="2"/>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 40}" fill="{s["text"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="16" font-weight="700">{label}</text>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 68}" fill="{s["sub"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="12">{sub}</text>')
        if i < len(NODES) - 1:
            ax = x + nw + 6
            ay = y0 + nh // 2
            parts.append(
                f'<path d="M{ax} {ay}h{gap - 12}" stroke="{s["sub"]}" '
                f'stroke-width="3"/>')
            parts.append(
                f'<path d="M{ax + gap - 14} {ay - 7}l10 7-10 7" fill="none" '
                f'stroke="{s["sub"]}" stroke-width="3" '
                f'stroke-linecap="round" stroke-linejoin="round"/>')
    # read/write bar under the console nodes
    bx, by, bw, bh = 60, 300, 1080, 58
    for cx in (600, 1050):  # mcp/status and patch-write centres
        parts.append(
            f'<path d="M{cx} {y0 + nh}v{by - y0 - nh}" '
            f'stroke="{FAMILY}" stroke-width="2" stroke-dasharray="5 5"/>')
    parts.append(
        f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="12" '
        f'fill="{s["box"]}" stroke="{FAMILY}" stroke-width="2"/>')
    parts.append(
        f'<text x="{bx + bw // 2}" y="{by + 35}" fill="{s["text"]}" '
        f'text-anchor="middle" font-family="ui-monospace,monospace" '
        f'font-size="14">read: mcp/status · write: cordis.patch.yml · '
        f'verify: loader</text>')
    parts.append(
        f'<text x="60" y="398" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="13">/mcp · /mcp &lt;server&gt; tools · '
        f'/mcp &lt;server&gt; health · /mcp &lt;server&gt; call</text>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        with open(os.path.join(OUT, f"dsh-mcp-panel-flow-{skin}.svg"),
                  "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
    print("wrote 2 SVG assets to docs/assets/")


if __name__ == "__main__":
    main()
