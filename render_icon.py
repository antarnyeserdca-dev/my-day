"""Generate the three PNG app icons from the simple vector design."""

import struct
import zlib
from pathlib import Path


GREEN = (34, 90, 68, 255)
PAPER = (244, 241, 232, 255)
ORANGE = (230, 152, 98, 255)


def inside_round_rect(x, y, size, radius):
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def color_at(x, y, size):
    scale = size / 512
    color = GREEN
    if (x - 256 * scale) ** 2 + (y - 256 * scale) ** 2 <= (162 * scale) ** 2:
        color = PAPER
    half = 29 * scale
    if 156 * scale <= y <= 356 * scale and abs(x - 256 * scale) <= half:
        color = GREEN
    if 156 * scale <= x <= 356 * scale and abs(y - 256 * scale) <= half:
        color = GREEN
    if (x - 364 * scale) ** 2 + (y - 148 * scale) ** 2 <= (52 * scale) ** 2:
        color = ORANGE
    return color


def write_png(path, size):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row.extend(color_at(x + 0.5, y + 0.5, size))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(name, data):
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


for icon_size in (180, 192, 512):
    write_png(Path(f"icons/icon-{icon_size}.png"), icon_size)
