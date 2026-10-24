#!/usr/bin/env python3
"""Draws the desktop wallpaper: a soft violet glow with the brand orb. Standard library only.

Usage: make-wallpaper.py OUTPUT.png [WIDTH HEIGHT]
"""
import math
import struct
import sys
import zlib

BG = (20, 18, 28)          # #14121c
GLOW = (74, 53, 176)       # #4a35b0
ACCENT = (167, 139, 250)   # #a78bfa

out = sys.argv[1]
w = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
h = int(sys.argv[3]) if len(sys.argv) > 3 else 800

# The orb sits slightly above centre so the bottom panel never covers it.
cx, cy = w / 2, h * 0.46
ring_r, ring_w = h * 0.115, max(2.0, h * 0.004)
dot_r = h * 0.052
glow_r = h * 0.62


def smooth(edge0, edge1, x):
    t = min(max((x - edge0) / (edge1 - edge0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


rows = bytearray()
for y in range(h):
    rows.append(0)  # PNG filter: none
    for x in range(w):
        d = math.hypot(x - cx, y - cy)
        px = BG
        # Wide soft glow, strongest behind the orb.
        px = mix(px, GLOW, 0.55 * math.exp(-((d / glow_r) ** 2)))
        # Ring: anti-aliased band around ring_r.
        ring = 1 - smooth(ring_w * 0.5, ring_w * 0.5 + 1.2, abs(d - ring_r))
        px = mix(px, ACCENT, 0.38 * ring)
        # Solid dot with a soft halo.
        dot = 1 - smooth(dot_r - 1.2, dot_r, d)
        px = mix(px, ACCENT, 0.55 * dot + 0.10 * math.exp(-((d / (dot_r * 2.2)) ** 2)))
        # Tiny deterministic dither so the gradient does not band.
        n = ((x * 73856093) ^ (y * 19349663)) % 3 - 1
        rows.extend(min(255, max(0, round(c) + n)) for c in px)


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


png = (
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
    + chunk(b"IEND", b"")
)
with open(out, "wb") as f:
    f.write(png)
print(f"wrote {out} ({w}x{h}, {len(png) // 1024} KiB)")
