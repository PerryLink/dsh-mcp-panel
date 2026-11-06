#!/usr/bin/env python3
"""README visuals for dsh-mcp-panel — derived from the console's real pipeline.

Two figures, both read off the shipped code rather than a generic template:

  hero 1440×576 (Pillow, 4 files: zh/en × light/dark)
      The console's two true surfaces.  Top: the Settings → Plugins → MCP
      server list from the `mcpPanel/status` snapshot — mono server name,
      declared transport, tool count, reconnect count, connection badge.  One
      row reads `unknown` on purpose (no upstream observation; the panel never
      infers a connection from tool-registry presence).  Bottom: the exact
      fragment shape `patch.ts` renders inside `write.ts`'s append path
      (`- insert:` / id / module / config), with the three audit stamps the
      host returns: approval path, backup file, loader re-verification.

  flow 1100×660 (hand-written SVG, 2 files: light/dark)
      A clockwise loop with two lanes.  READ descends on the left (collect →
      aggregate + redact → wire snapshot → surfaces); WRITE ascends on the
      right (form → validate/resolve → render fragment → approval → backup,
      append, verify).  The top band is the return lane: the appended block
      reaches `cordis.patch.yml`, the loader replays it and instantiates the
      mcp-client rows again — arrows therefore point right-to-left there, and
      a dashed edge carries the re-applied state back into the write gate.
      The bottom connector is the human step: the operator acts on the same
      settings page that the read channel rendered.

Faithful facts used here (no invented capability):
  src/patch.ts      `- insert:` + `- id:` + `name:` + `config:` fragment shape,
                    id-targeted overrides, no `set`, no remove
  src/write.ts      `.bak-<epoch-ms>` backup, append-only, read-back check
  src/service.ts    approval paths (`harness-approval` / interactive
                    confirmation), `writeVerified` against loader rows,
                    `writeVerifyTimeoutMs` polling budget
  src/wire.ts       `statusSource: 'upstream-event' | 'derived'`,
                    `phase: unknown`, `reconnectCount: -1` when unobserved
  src/upstream.ts   `mcp/status` proposal consumed by feature detection
  cordis.patch.yml  the 15 documented keys, `writeEnabled` as the kill switch

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow + Windows fonts msyh.ttc / msyhbd.ttc / consola.ttf.
"""
from __future__ import annotations

import math
import os
from html import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

FONT_CJK = r"C:\Windows\Fonts\msyh.ttc"
FONT_CJK_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"
FONT_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"
for _p in (FONT_CJK, FONT_CJK_BOLD, FONT_MONO, FONT_MONO_BOLD):
    if not os.path.exists(_p):
        raise SystemExit(f"FATAL: font missing: {_p}")

RADIUS = 22
SHADOW = 26

SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        card="#ffffff", card_edge="#e6e2ef",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", accent2="#16a34a",
        pill="#ece7f9", band="#f5f2fb", grid="#e7e4f0",
        ok="#16a34a", ok_bg="#e8f5ec",
        warn="#b45309", warn_bg="#fdf3e9",
        shadow=(32, 26, 64), glow2="#7a68c9",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        card="#1b2231", card_edge="#2e374b",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", accent2="#3fb950",
        pill="#242d42", band="#202839", grid="#262f42",
        ok="#3fb950", ok_bg="#16301f",
        warn="#d9a441", warn_bg="#2a2216",
        shadow=(0, 0, 0), glow2="#8496f5",
    ),
}

FONT_FILES = {"cjk": FONT_CJK, "cjk_bold": FONT_CJK_BOLD,
              "mono": FONT_MONO, "mono_bold": FONT_MONO_BOLD}


def font(size: int, kind: str = "cjk_bold") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_FILES[kind], size)


def hx(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def gradient(w: int, h: int, c1: str, c2: str) -> Image.Image:
    base = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(base)
    a, b = hx(c1), hx(c2)
    for y in range(h):
        t = 0.15 * (y / h) + 0.85 * (y / h) ** 1.35
        d.line([(0, y), (w, y)],
               fill=tuple(int(p + (q - p) * t) for p, q in zip(a, b)))
    return base


def glow(img: Image.Image, cx: int, cy: int, r: int, color: tuple,
         alpha: int = 40) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(9, 0, -1):
        rr = r * i / 9
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=color + (int(alpha * (1 - i / 10)),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def card(img: Image.Image, box: tuple, s: dict, radius: int = RADIUS,
         shadow: int = SHADOW, fill: str | None = None) -> Image.Image:
    """A soft-shadowed rounded card on the gradient background."""
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -3):
        sd.rounded_rectangle([x0 - i // 5, y0 + i // 2, x1 + i // 5, y1 + i],
                             radius=radius + i // 5,
                             fill=s["shadow"] + (int(9 * (1 - i / shadow)),))
    base = Image.alpha_composite(img.convert("RGBA"),
                                 sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(fill or s["card"]),
                        outline=hx(s["card_edge"]), width=2)
    return base.convert("RGB")


_SCRATCH = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def measure(text: str, size: int, kind: str) -> float:
    return _SCRATCH.textlength(text, font=font(size, kind))


def require_w(text: str, size: int, kind: str, max_w: float,
              what: str) -> None:
    """Fail loudly instead of shipping a clipped label."""
    w = measure(text, size, kind)
    if w > max_w + 0.4:
        raise SystemExit(f"FATAL: {what} overflows: {text!r} needs {w:.1f}px > {max_w}px")


def fit(text: str, kind: str, max_w: float, start: int, minimum: int) -> int:
    size = start
    while size > minimum:
        if measure(text, size, kind) <= max_w:
            return size
        size -= 1
    raise SystemExit(f"FATAL: text does not fit {max_w}px at >= {minimum}px: {text!r}")


def fit_lines(lines: list[str], kind: str, max_w: float, start: int,
              minimum: int) -> int:
    return min(fit(t, kind, max_w, start, minimum) for t in lines)


def wrap(d: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont,
         maxw: float) -> list[str]:
    if " " in text:
        words, lines, cur = text.split(" "), [], ""
        for wd in words:
            cand = (cur + " " + wd) if cur else wd
            if d.textlength(cand, font=f) <= maxw or not cur:
                cur = cand
            else:
                lines.append(cur)
                cur = wd
        if cur:
            lines.append(cur)
        return lines
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=f) <= maxw or not cur:
            cur += ch
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def pill(img: Image.Image, xy: tuple[int, int], text: str, s: dict,
         size: int = 16, fg: str | None = None, bg: str | None = None) -> tuple[int, int]:
    d = ImageDraw.Draw(img)
    f = font(size, "cjk_bold")
    w = d.textlength(text, font=f)
    x, y = xy
    h = size + 20
    d.rounded_rectangle([x, y, x + w + 30, y + h], radius=h // 2,
                        fill=hx(bg or s["pill"]))
    d.text((x + 15, y + h / 2), text, font=f, fill=hx(fg or s["accent"]),
           anchor="lm")
    return int(x + w + 30), int(y + h)


def chip(img: Image.Image, xy: tuple[int, int], text: str, fg: str, bg: str,
         size: int = 11, kind: str = "cjk_bold", padx: int = 9,
         height: int = 20) -> int:
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    w = d.textlength(text, font=f)
    x, y = xy
    d.rounded_rectangle([x, y, x + w + padx * 2, y + height],
                        radius=height // 2, fill=hx(bg))
    d.text((x + padx, y + height / 2), text, font=f, fill=hx(fg), anchor="lm")
    return int(w + padx * 2)


def rchip(img: Image.Image, x_right: int, y: int, text: str, fg: str, bg: str,
          size: int = 11, kind: str = "cjk_bold", padx: int = 9,
          height: int = 20) -> int:
    """A pill anchored on its right edge; returns its left edge."""
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    w = d.textlength(text, font=f) + padx * 2
    x = x_right - w
    d.rounded_rectangle([x, y, x + w, y + height], radius=height // 2,
                        fill=hx(bg))
    d.text((x + padx, y + height / 2), text, font=f, fill=hx(fg), anchor="lm")
    return int(x)


def check(d: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    d.line([(x, y + 4), (x + 4, y + 8), (x + 11, y - 3)], fill=hx(color), width=2)


def dash_rect(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int],
              color: str, width: int = 2, dash: int = 7, gap: int = 5) -> None:
    x0, y0, x1, y1 = box
    for a, b in (((x0, y0), (x1, y0)), ((x0, y1), (x1, y1)),
                 ((x0, y0), (x0, y1)), ((x1, y0), (x1, y1))):
        dist = math.hypot(b[0] - a[0], b[1] - a[1])
        n = int(dist // (dash + gap)) + 1
        for i in range(n):
            t0 = i * (dash + gap) / dist
            t1 = min((i * (dash + gap) + dash) / dist, 1.0)
            if t0 >= 1:
                break
            d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
                    (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)],
                   fill=hx(color), width=width)


# --------------------------------------------------------------------------- hero
# The server rows and the fragment are the console's two real surfaces.  Badge
# codes are the wire vocabulary (`connected` / `waiting` / `unknown`); the
# `unknown` row carries `statusSource: derived` exactly as src/present.ts does.
YAML_LINES = [
    "# dsh-mcp-panel: add server (2026-11-06)",
    "- insert:",
    "    - id: mcp-github",
    "      name: '@deepseek-ai/dsh-mcp-client'",
    "      config:",
    "        serverName: github",
    "        transport: streamable-http",
]

SERVERS = [
    # name, transport, tools, reconnect, badge, tone
    ("github", "streamable-http", "1 tool", "0", "connected", "ok"),
    ("filesystem", "stdio", "4 tools", "—", "unknown", "muted"),
    ("fetch", "streamable-http", "3 tools", "2", "waiting", "warn"),
]

HERO = {
    "zh": dict(
        kicker="DeepSeek Harness 插件 · MCP 控制台",
        value=["MCP 服务器管理收进一页", "状态照实，写入可逆"],
        sub=["官方 mcp-client 仍是桥接：控制台只读取事实，",
             "写入只追加片段：审批 → 备份 → loader 复验。"],
        meta="15 个配置键 · writeEnabled 总开关 · unknown 不伪造",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        tab_title="设置 → 插件 → MCP",
        tab_chip="只读视图",
        summary="3 个 server · 1 已连接 · 1 未观测",
        col_headers=["服务器", "传输", "工具", "重连", "状态"],
        note="未观测的连接字段 = unknown / —（statusSource: derived），不按工具存在与否推断",
        frag_title="追加片段 · cordis.patch.yml",
        frag_chip="只追加",
        stamps=["审批 allowed-once", "备份 .bak-1780…", "复验 loader 已应用"],
        frag_note="只追加、不改写已有行；loader 未应用即失败（备份保留）",
        strip_l="读 mcp/status seam · 写 cordis.patch.yml",
        strip_r="unknown 不伪造",
    ),
    "en": dict(
        kicker="DeepSeek Harness plugin · MCP console",
        value=["Every MCP server on one page", "honest status, reversible writes"],
        sub=["The bridge stays official; the console reads facts,",
             "writes append-only: approval, backup, loader verify."],
        meta="15 config keys · writeEnabled kill switch · unknown never faked",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        tab_title="Settings → Plugins → MCP",
        tab_chip="read-only view",
        summary="3 servers · 1 connected · 1 unobserved",
        col_headers=["server", "transport", "tools", "reconnect", "state"],
        note="Unobserved connection fields read unknown / — (statusSource: derived), never inferred",
        frag_title="Appended fragment · cordis.patch.yml",
        frag_chip="append-only",
        stamps=["approval allowed-once", "backup .bak-1780…", "verify loader applied"],
        frag_note="append-only, existing rows untouched; not re-applied = failure (backup kept)",
        strip_l="reads mcp/status seam · writes cordis.patch.yml",
        strip_r="unknown never faked",
    ),
}

TONE = {
    "ok": ("ok", "ok_bg"),
    "warn": ("warn", "warn_bg"),
    "muted": ("faint", "pill"),
}


def hero(lang: str, skin: str) -> None:
    s = SKIN[skin]
    H = HERO[lang]
    W, HT = 1440, 576
    img = gradient(W, HT, s["bg_from"], s["bg_to"])
    img = glow(img, 1180, 30, 420, hx(s["accent"]),
               24 if skin == "light" else 38)
    img = glow(img, 90, 580, 300, hx(s["glow2"]),
               10 if skin == "light" else 16)

    d = ImageDraw.Draw(img)
    m = 64
    col_w = 596

    # ---- left column: kicker / title / value / sub / meta / footer -----------
    pill(img, (m, 56), H["kicker"], s, size=17)
    d = ImageDraw.Draw(img)

    title_size = fit("dsh-mcp-panel", "mono_bold", col_w, 58, 48)
    d.text((m - 2, 118), "dsh-mcp-panel", font=font(title_size, "mono_bold"),
           fill=hx(s["text"]))

    vf = fit_lines(H["value"], "cjk_bold", col_w, 42, 34)
    for i, line in enumerate(H["value"]):
        require_w(line, vf, "cjk_bold", col_w, "hero value")
        d.text((m, 204 + i * 56), line, font=font(vf, "cjk_bold"),
               fill=hx(s["text"]))

    for i, line in enumerate(H["sub"]):
        require_w(line, 22, "cjk", col_w, "hero sub")
        d.text((m + 1, 334 + i * 34), line, font=font(22, "cjk"),
               fill=hx(s["sub"]))

    require_w(H["meta"], 19, "cjk", col_w, "hero meta")
    require_w(H["foot"], 16, "cjk", col_w, "hero footer")
    d.text((m + 1, 428), H["meta"], font=font(19, "cjk"), fill=hx(s["faint"]))
    d.line([m + 1, 480, m + col_w - 4, 480], fill=hx(s["grid"]), width=2)
    d.text((m + 1, 494), H["foot"], font=font(16, "cjk"), fill=hx(s["faint"]))

    # ---- right card A: the MCP settings tab ---------------------------------
    img = card(img, (700, 40, 1376, 306), s, radius=RADIUS, shadow=SHADOW)
    d = ImageDraw.Draw(img)
    d.text((724, 58), H["tab_title"], font=font(16, "cjk_bold"),
           fill=hx(s["text"]))
    require_w(H["tab_title"], 16, "cjk_bold", 480, "tab title")
    rchip(img, 1352, 54, H["tab_chip"], s["accent"], s["pill"], size=11)
    d = ImageDraw.Draw(img)
    d.text((724, 86), H["summary"], font=font(13, "cjk"), fill=hx(s["faint"]))
    require_w(H["summary"], 13, "cjk", 600, "summary")

    cols = [724, 920, 1044, 1160]
    d.line([724, 124, 1352, 124], fill=hx(s["grid"]), width=1)
    for i, head in enumerate(H["col_headers"]):
        head_font = font(10.5, "cjk_bold")
        if i < 4:
            d.text((cols[i], 112), head, font=head_font, fill=hx(s["faint"]))
        else:
            d.text((1352, 112), head, font=head_font, fill=hx(s["faint"]),
                   anchor="ra")

    row_top = 132
    row_h = 44
    for i, (name, transport, tools, reconnect, badge, tone) in enumerate(SERVERS):
        ry = row_top + i * row_h
        d.text((724, ry + 11), name, font=font(14, "mono_bold"),
               fill=hx(s["text"]))
        d.text((920, ry + 14), transport, font=font(10.5, "mono"),
               fill=hx(s["sub"]))
        d.text((1044, ry + 14), tools, font=font(10.5, "mono"),
               fill=hx(s["sub"]))
        d.text((1160, ry + 14), reconnect, font=font(10.5, "mono"),
               fill=hx(s["faint"]))
        fg_key, bg_key = TONE[tone]
        rchip(img, 1352, ry + 7, badge, fg=s[fg_key], bg=s[bg_key], size=10.5,
              kind="mono_bold")
        d = ImageDraw.Draw(img)
        if i < len(SERVERS) - 1:
            d.line([724, ry + row_h, 1352, ry + row_h], fill=hx(s["grid"]),
                   width=1)
    d.text((724, 280), H["note"], font=font(11.5, "cjk"), fill=hx(s["faint"]))
    require_w(H["note"], 11.5, "cjk", 628, "table note")

    # ---- right card B: the append-only fragment + audit stamps --------------
    img = card(img, (700, 316, 1376, 500), s, radius=RADIUS, shadow=SHADOW)
    d = ImageDraw.Draw(img)
    d.text((724, 328), H["frag_title"], font=font(14.5, "cjk_bold"),
           fill=hx(s["accent"]))
    require_w(H["frag_title"], 14.5, "cjk_bold", 470, "fragment title")
    rchip(img, 1352, 324, H["frag_chip"], s["accent"], s["pill"], size=10.5)
    d = ImageDraw.Draw(img)

    y = 352
    for i, line in enumerate(YAML_LINES):
        require_w(line, 11.5, "mono", 300, "yaml line")
        color = s["faint"] if i == 0 else (s["accent"] if i == 1 else s["text"])
        d.text((724, y + i * 17), line, font=font(11.5, "mono"),
               fill=hx(color))

    for i, stamp in enumerate(H["stamps"]):
        sy = 354 + i * 26
        check(d, 1030, sy + 7, s["accent2"])
        require_w(stamp, 11, "cjk", 300, "audit stamp")
        d.text((1048, sy), stamp, font=font(11, "cjk"), fill=hx(s["sub"]))

    d.text((724, 478), H["frag_note"], font=font(11, "cjk"), fill=hx(s["faint"]))
    require_w(H["frag_note"], 11, "cjk", 628, "fragment note")

    # ---- right card C: the one-line contract --------------------------------
    img = card(img, (700, 508, 1376, 552), s, radius=18, shadow=16)
    d = ImageDraw.Draw(img)
    d.text((724, 523), H["strip_l"], font=font(13, "cjk"), fill=hx(s["text"]))
    require_w(H["strip_l"], 13, "cjk", 430, "strip left")
    d.text((1352, 523), H["strip_r"], font=font(13, "cjk_bold"),
           fill=hx(s["accent2"]), anchor="ra")
    require_w(H["strip_r"], 13, "cjk_bold", 200, "strip right")

    name = f"dsh-mcp-panel-hero-{lang}-{skin}.webp"
    img.save(os.path.join(OUT, name), "WEBP", quality=92, method=6)
    print(f"wrote {name} ({W}×{HT})")


# --------------------------------------------------------------------------- flow
FLOW = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        panel="#ffffff", edge="#e6e2ef", band="#f5f2fb", band_alt="#faf8fe",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", accent2="#16a34a", rule="#dcd8ea",
        shadow="0.10",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        panel="#1b2231", edge="#2e374b", band="#202839", band_alt="#1e2534",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", accent2="#3fb950", rule="#2b3348",
        shadow="0.45",
    ),
}

FONT_CSS_CJK = ("'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',"
                "'Source Han Sans SC',sans-serif")
FONT_CSS_MONO = ("'Consolas','SFMono-Regular','Menlo',ui-monospace,monospace")


class Svg:
    """Tiny SVG writer that measures every label before it is emitted."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.overflows: list[str] = []

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    def text(self, x: float, y: float, content: str, size: float, fill: str, *,
             anchor: str = "start", weight: int | None = None,
             mono: bool = False, max_w: float | None = None,
             opacity: float | None = None, tracking: float | None = None) -> None:
        kind = ("mono" if mono else "cjk") + ("_bold" if weight else "")
        if mono and weight:
            kind = "mono_bold"
        if max_w is not None:
            w = measure(content, size, kind)
            if tracking:
                w += tracking * max(len(content) - 1, 0)
            if w > max_w + 0.4:
                self.overflows.append(
                    f"{content!r} needs {w:.1f}px > {max_w}px")
        family = FONT_CSS_MONO if mono else FONT_CSS_CJK
        attrs = [f'x="{x}"', f'y="{y}"', f'fill="{fill}"',
                 f'font-family="{family}"', f'font-size="{size}"']
        if anchor != "start":
            attrs.append(f'text-anchor="{anchor}"')
        if weight:
            attrs.append(f'font-weight="{weight}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        if tracking:
            attrs.append(f'letter-spacing="{tracking}"')
        self.add(f'<text {" ".join(attrs)}>{escape(content)}</text>')

    def rect(self, x: float, y: float, w: float, h: float, *, fill: str,
             rx: float = 0, stroke: str | None = None, sw: float = 1.5,
             shadow: bool = False, dash: str | None = None,
             opacity: float | None = None) -> None:
        attrs = [f'x="{x}"', f'y="{y}"', f'width="{w}"', f'height="{h}"']
        if rx:
            attrs.append(f'rx="{rx}"')
        attrs.append(f'fill="{fill}"')
        if stroke:
            attrs.append(f'stroke="{stroke}"')
            attrs.append(f'stroke-width="{sw}"')
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        if shadow:
            attrs.append('filter="url(#soft)"')
        self.add(f'<rect {" ".join(attrs)}/>')

    def line(self, x1: float, y1: float, x2: float, y2: float, *, stroke: str,
             sw: float = 1.5, dash: str | None = None,
             marker: str | None = None, opacity: float | None = None) -> None:
        attrs = [f'x1="{x1}"', f'y1="{y1}"', f'x2="{x2}"', f'y2="{y2}"',
                 f'stroke="{stroke}"', f'stroke-width="{sw}"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if marker:
            attrs.append(f'marker-end="url(#{marker})"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<line {" ".join(attrs)}/>')

    def path(self, d: str, *, stroke: str, sw: float = 1.5,
             marker: str | None = None, dash: str | None = None,
             fill: str = "none") -> None:
        attrs = [f'd="{d}"', f'fill="{fill}"', f'stroke="{stroke}"',
                 f'stroke-width="{sw}"', 'stroke-linecap="round"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if marker:
            attrs.append(f'marker-end="url(#{marker})"')
        self.add(f'<path {" ".join(attrs)}/>')

    def circle(self, cx: float, cy: float, r: float, *, fill: str,
               stroke: str | None = None, sw: float = 1.5,
               opacity: float | None = None) -> None:
        attrs = [f'cx="{cx}"', f'cy="{cy}"', f'r="{r}"', f'fill="{fill}"']
        if stroke:
            attrs.append(f'stroke="{stroke}"')
            attrs.append(f'stroke-width="{sw}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<circle {" ".join(attrs)}/>')

    def chip(self, x_right: float, y: float, label: str, fg: str, bg: str,
             *, size: float = 11, pad: float = 9, height: float = 20,
             mono: bool = False, weight: int | None = None) -> float:
        """A pill anchored on its right edge; returns its left edge."""
        kind = "mono" if mono else "cjk"
        if weight:
            kind += "_bold"
        w = measure(label, size, kind) + pad * 2
        x = x_right - w
        self.rect(x, y, w, height, fill=bg, rx=height / 2)
        self.text(x + pad, y + height / 2 + size * 0.34, label, size, fg,
                  anchor="start", weight=weight, mono=mono)
        return x

    def svg(self, w: int, h: int, label: str) -> str:
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" '
                f'height="{h}" viewBox="0 0 {w} {h}" role="img" '
                f'aria-label="{escape(label)}">')
        return "\n".join([head, *self.parts, "</svg>"]) + "\n"


def flow_svg(skin: str) -> str:
    s = FLOW[skin]
    W, H = 1100, 660
    v = Svg()

    v.add("<defs>")
    v.add(f'<linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">'
          f'<stop offset="0" stop-color="{s["bg_from"]}"/>'
          f'<stop offset="1" stop-color="{s["bg_to"]}"/></linearGradient>')
    v.add(f'<filter id="soft" x="-30%" y="-30%" width="160%" height="170%">'
          f'<feDropShadow dx="0" dy="7" stdDeviation="9" '
          f'flood-color="#16122c" flood-opacity="{s["shadow"]}"/></filter>')
    v.add('<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" '
          'markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">'
          f'<path d="M0 0 L10 5 L0 10 z" fill="{s["accent"]}"/></marker>')
    v.add("</defs>")
    v.add(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')

    # ---- header -------------------------------------------------------------
    v.text(44, 58, "dsh-mcp-panel", 28, s["text"], weight=700, mono=True,
           max_w=620)
    v.text(44, 86,
           "官方 mcp-client 是桥接，本插件是控制台：读只读事实，写只追加片段，落盘后由 loader 复验。",
           15, s["sub"], max_w=880)
    v.chip(1056, 34, "读只读 · 写只追加", s["accent"], s["band"],
           size=12, pad=12, height=26)

    # ---- return band: patch → loader → bridge (arrows point left) -----------
    v.rect(44, 100, 1012, 100, fill=s["panel"], rx=20, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.text(62, 120, "上游 · 官方桥接（传输 / OAuth / 协议不动）", 11.5,
           s["faint"], max_w=520)
    v.text(1038, 120, "落盘 → 重放 → 实例", 11.5, s["faint"], anchor="end",
           max_w=220)

    v.rect(62, 132, 270, 44, fill=s["band"], rx=12, stroke=s["edge"], sw=1.2)
    v.text(74, 150, "mcp-client × N", 13.5, s["text"], weight=700, mono=True,
           max_w=240)
    v.text(74, 167, "stdio · http · mcp__<server>__<tool>", 11, s["sub"],
           mono=True, max_w=246)

    v.rect(372, 132, 270, 44, fill=s["band"], rx=12, stroke=s["edge"], sw=1.2)
    v.text(384, 150, "loader", 13.5, s["text"], weight=700, mono=True,
           max_w=240)
    v.text(384, 167, "entry config · disabled · fiber", 11, s["sub"], mono=True,
           max_w=246)

    v.rect(682, 132, 356, 44, fill=s["band"], rx=12, stroke=s["accent"],
           sw=1.6)
    v.text(694, 150, "cordis.patch.yml", 13.5, s["text"], weight=700, mono=True,
           max_w=320)
    v.text(694, 167, "insert / - id: 覆盖 · 无 remove", 11, s["sub"],
           max_w=330)

    v.line(678, 154, 646, 154, stroke=s["accent"], sw=1.8, marker="arr")
    v.line(366, 154, 336, 154, stroke=s["accent"], sw=1.8, marker="arr")

    # ---- read lane: facts descend on the left -------------------------------
    v.line(200, 176, 200, 216, stroke=s["accent"], sw=1.8, marker="arr")
    v.line(440, 176, 440, 216, stroke=s["accent"], sw=1.8, marker="arr")

    v.rect(44, 220, 480, 320, fill=s["panel"], rx=20, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.text(62, 243, "读取 · 只读", 13.5, s["accent"], weight=700, max_w=200)
    v.chip(506, 231, "不写入", s["faint"], s["band"], size=11, pad=10,
           height=20)

    read_steps = [
        (252, 52, "1", "采集事实",
         ["loader rows · tools.schemas · mcp/status · ctx.jobs"], []),
        (318, 52, "2", "聚合 + 打码",
         ["aggregateSnapshot · URL / header / Bearer / JWT 打码"], []),
        (384, 52, "3", "快照 wire",
         ["server[] · tools[] · probes[] · zod 严格 codec"], []),
        (450, 74, "4", "输出面", [
            "/mcp 命令 — 模型可见、日志可重建",
            "设置 → 插件 → MCP — 仅面板，永不进模型上下文",
            "试用台 · Resources — 走官方 ctx.tools.execute",
        ], []),
    ]
    for top, height, num, title, notes, _ in read_steps:
        v.rect(62, top, 444, height, fill=s["band"], rx=12)
        v.rect(62, top + 10, 3, height - 20, fill=s["accent"], rx=1.5)
        v.rect(78, top + height / 2 - 10, 20, 20, fill=s["panel"], rx=6,
               stroke=s["accent"], sw=1.2)
        v.text(88, top + height / 2 + 4, num, 11, s["accent"], anchor="middle",
               weight=700, mono=True)
        v.text(108, top + 20, title, 13.5, s["text"], weight=700, max_w=380)
        for i, note in enumerate(notes):
            v.text(108, top + 37 + i * 16, note, 11.5, s["sub"], max_w=386)

    for y1, y2 in ((304, 318), (370, 384), (436, 450)):
        v.line(284, y1, 284, y2 - 2, stroke=s["accent"], sw=1.6, marker="arr")

    # ---- write gate: the fragment climbs on the right -----------------------
    v.rect(576, 220, 480, 320, fill=s["panel"], rx=20, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.text(594, 243, "写入 · 只追加", 13.5, s["accent"], weight=700, max_w=200)
    v.chip(1038, 231, "审批闸门", s["faint"], s["band"], size=11, pad=10,
           height=20)

    write_steps = [
        (476, "1", "表单操作", "add · edit · disable · enable（都在设置页里）"),
        (420, "2", "校验 + 对照 loader",
         "serverName / transport / url 校验 · 定向 entry id"),
        (364, "3", "渲染只追加片段",
         "insert / - id: + name: + disabled|config"),
        (308, "4", "审批",
         "allowed-once · 交互确认 · writeEnabled 总开关"),
        (252, "5", "备份 → 追加 → 复验",
         ".bak-<epoch-ms> · 只追加 · loader 未应用即失败"),
    ]
    for top, num, title, note in write_steps:
        v.rect(594, top, 444, 44, fill=s["band"], rx=12)
        v.rect(594, top + 9, 3, 26, fill=s["accent"], rx=1.5)
        v.rect(610, top + 12, 20, 20, fill=s["panel"], rx=6,
               stroke=s["accent"], sw=1.2)
        v.text(620, top + 26, num, 11, s["accent"], anchor="middle", weight=700,
               mono=True)
        v.text(640, top + 19, title, 13.5, s["text"], weight=700, max_w=380)
        v.text(640, top + 35, note, 11.5, s["sub"], max_w=386)

    for y1, y2 in ((476, 464), (420, 408), (364, 352), (308, 296)):
        v.line(816, y1, 816, y2 + 2, stroke=s["accent"], sw=1.6, marker="arr")

    # fragment leaves the gate upward into the patch layer
    v.line(930, 250, 930, 180, stroke=s["accent"], sw=1.8, marker="arr")
    v.text(938, 214, "追加", 11, s["faint"], max_w=40)

    # re-applied loader state returns into the gate (dashed)
    v.path("M630 178 V206 H700 V248", stroke=s["accent"], sw=1.4, dash="5 4",
           marker="arr")
    v.text(708, 232, "loader 复验", 11, s["faint"], max_w=90)

    # ---- the human step closes the loop -------------------------------------
    v.path("M506 490 H550 V500 H590", stroke=s["accent2"], sw=1.6,
           marker="arr")
    v.text(550, 482, "操作", 11, s["faint"], anchor="middle", max_w=36)

    # ---- footer -------------------------------------------------------------
    v.line(44, 564, 1056, 564, stroke=s["rule"], sw=1)
    v.text(44, 588,
           "读：mcp/status seam 未观测时如实 unknown / —（statusSource: derived），不按工具存在与否推断连接状态。",
           11.5, s["sub"], max_w=1012)
    v.text(44, 612,
           "写：只追加 + 先备份 + loader 复验（未应用即失败）；writeEnabled: false 拒绝一切写入，片段仍可复制。",
           11.5, s["faint"], max_w=1012)

    if v.overflows:
        raise SystemExit("FATAL: SVG label overflow:\n  " + "\n  ".join(v.overflows))
    return v.svg(W, H, "dsh-mcp-panel 结构图：左侧读取通道从 loader、工具注册表与 "
                       "mcp/status 采集事实并输出快照；右侧写入通道把表单操作渲染成"
                       "只追加片段，经审批、备份、追加与 loader 复验；顶部回程把落盘"
                       "的 patch 经 loader 重放回实例")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin)
        name = f"dsh-mcp-panel-flow-v5-{skin}.svg"
        with open(os.path.join(OUT, name), "w", encoding="utf-8",
                  newline="\n") as fh:
            fh.write(flow_svg(skin))
        print(f"wrote {name} (1100×660)")


if __name__ == "__main__":
    main()
