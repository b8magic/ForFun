#!/usr/bin/env python3
"""Gate Maestro 01's Surf-focused mixed day using the actual screenshot pixels.

The fixture has Surf on days 10/12 and Corsa only on day 10. Find a small shared
red/lime calendar cell without assuming which month row contains day 10. Ignore
the top 15% (header) and bottom 25% (activity dock). No image dependencies: only
8-bit, non-interlaced RGB/RGBA PNGs, as emitted by simctl and sips, are supported.
"""
import argparse
from dataclasses import dataclass
import math
from pathlib import Path
import struct
import sys
import zlib

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_BYTES = 64 * 1024 * 1024
RED = (255, 77, 31)
# softenColor('#C9F06A', '#F6F2E9', 0.47), while Surf is active.
MUTED_LIME = (225, 241, 173)


@dataclass(frozen=True)
class Raster:
    width: int
    height: int
    channels: int
    pixels: bytes


def decode_png(data):
    """Decode the bounded screenshot subset, including all five PNG filters."""
    if len(data) > MAX_BYTES or data[:8] != PNG_SIGNATURE:
        raise ValueError("expected a PNG no larger than 64 MiB")
    offset = 8
    header = None
    compressed = bytearray()
    ended = False
    while offset + 12 <= len(data):
        length, kind = struct.unpack_from(">I4s", data, offset)
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("truncated PNG chunk")
        payload = data[offset + 8:end - 4]
        crc = struct.unpack_from(">I", data, end - 4)[0]
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != crc:
            raise ValueError("PNG chunk checksum mismatch")
        if kind == b"IHDR":
            if offset != 8 or header is not None or length != 13:
                raise ValueError("invalid PNG header")
            width, height, depth, color, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", payload,
            )
            if not width or not height or depth != 8 or color not in (2, 6) or (
                compression, filtering, interlace
            ) != (0, 0, 0):
                raise ValueError("only 8-bit non-interlaced RGB/RGBA PNGs are supported")
            channels = 3 if color == 2 else 4
            stride = width * channels
            expected = height * (stride + 1)
            if expected > MAX_BYTES:
                raise ValueError("decoded PNG exceeds 64 MiB")
            header = (width, height, channels, stride, expected)
        elif kind == b"IDAT":
            if header is None:
                raise ValueError("PNG image data precedes its header")
            compressed.extend(payload)
        elif kind == b"IEND":
            if length:
                raise ValueError("invalid PNG end chunk")
            ended = True
            break
        elif not kind[0] & 0x20 and kind != b"PLTE":
            raise ValueError("unsupported critical PNG chunk")
        offset = end
    if header is None or not compressed or not ended:
        raise ValueError("incomplete PNG")
    width, height, channels, stride, expected = header
    inflater = zlib.decompressobj()
    raw = inflater.decompress(compressed, expected + 1)
    if len(raw) != expected or not inflater.eof or inflater.unused_data:
        raise ValueError("invalid PNG decompressed size or stream")
    pixels = bytearray(stride * height)
    previous = bytes(stride)
    for y in range(height):
        start = y * (stride + 1)
        filter_type = raw[start]
        row = bytearray(raw[start + 1:start + 1 + stride])
        if filter_type > 4:
            raise ValueError("invalid PNG row filter")
        if filter_type:
            for i in range(stride):
                left = row[i - channels] if i >= channels else 0
                up = previous[i]
                if filter_type == 1:
                    predictor = left
                elif filter_type == 2:
                    predictor = up
                elif filter_type == 3:
                    predictor = (left + up) // 2
                else:
                    upper_left = previous[i - channels] if i >= channels else 0
                    p = left + up - upper_left
                    a, b, c = abs(p - left), abs(p - up), abs(p - upper_left)
                    predictor = left if a <= b and a <= c else up if b <= c else upper_left
                row[i] = (row[i] + predictor) & 255
        pixels[y * stride:(y + 1) * stride] = row
        previous = row
    return Raster(width, height, channels, bytes(pixels))


@dataclass(frozen=True)
class Patch:
    count: int
    left: int
    top: int
    right: int
    bottom: int


def components(mask, width):
    """Eight-connected color interiors; text/antialiasing need not match."""
    patches = []
    while mask:
        pending = [mask.pop()]
        count = 0
        left, top, right, bottom = width, sys.maxsize, 0, 0
        while pending:
            point = pending.pop()
            x, y = point % width, point // width
            count += 1
            left, top = min(left, x), min(top, y)
            right, bottom = max(right, x), max(bottom, y)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if (dx or dy) and 0 <= x + dx < width:
                        neighbor = point + dy * width + dx
                        if neighbor in mask:
                            mask.remove(neighbor)
                            pending.append(neighbor)
        patches.append(Patch(count, left, top, right, bottom))
    return patches


def inspect_colors(raster, red=RED, lime=MUTED_LIME, tolerance=8):
    width, height, channels = raster.width, raster.height, raster.channels
    masks = (set(), set())
    # Portrait phone screenshots: this excludes the dock even in the full simctl
    # originals. A month's position and weekday alignment remain unconstrained.
    region_top, region_bottom = math.ceil(height * 0.15), math.floor(height * 0.75)
    for y in range(region_top, region_bottom):
        for x in range(width):
            point = y * width + x
            i = point * channels
            if channels == 4 and raster.pixels[i + 3] < 250:
                continue
            pixel = raster.pixels[i:i + 3]
            for target, mask in zip((red, lime), masks):
                if all(abs(pixel[c] - target[c]) <= tolerance for c in range(3)):
                    mask.add(point)
    totals = tuple(len(mask) for mask in masks)
    # Scale area with image width so an original and a thumbnail use the same
    # threshold. A single fringe or icon cannot satisfy a color's fill area.
    minimum = max(12, math.ceil(width * width * 0.00075))
    patches = tuple([p for p in components(mask, width) if p.count >= minimum] for mask in masks)
    max_side = math.ceil(width * 0.14)  # a 44 pt cell on a 390 pt screen is 11.3%
    pair = None
    for first in patches[0]:
        for second in patches[1]:
            left, top = min(first.left, second.left), min(first.top, second.top)
            right, bottom = max(first.right, second.right), max(first.bottom, second.bottom)
            if right - left + 1 <= max_side and bottom - top + 1 <= max_side and (
                max(first.left, second.left) <= min(first.right, second.right)
                and max(first.top, second.top) <= min(first.bottom, second.bottom)
            ):
                pair = (first, second, (left, top, right, bottom))
                break
        if pair:
            break
    details = (
        f"{width}x{height}; calendar red={totals[0]}, muted-lime={totals[1]}; "
        f"minimum/color={minimum}; same-day={'yes' if pair else 'no'}"
    )
    if pair:
        first, second, bounds = pair
        details += f" ({first.count}/{second.count} pixels, bounds={bounds})"
    return pair is not None, details


def hex_color(value):
    value = value.lstrip("#")
    try:
        if len(value) != 6:
            raise ValueError()
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError as error:
        raise argparse.ArgumentTypeError("expected a six-digit RGB hex color") from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("screenshot", type=Path)
    parser.add_argument("--red", type=hex_color, default=RED)
    parser.add_argument("--lime", type=hex_color, default=MUTED_LIME)
    args = parser.parse_args()
    try:
        if args.screenshot.stat().st_size > MAX_BYTES:
            raise ValueError("PNG exceeds 64 MiB")
        raster = decode_png(args.screenshot.read_bytes())
        passed, details = inspect_colors(raster, args.red, args.lime)
    except (OSError, ValueError, zlib.error) as error:
        print(f"Native mixed-day colors: FAILED ({args.screenshot.name}: {error})")
        return 1
    print(f"Native mixed-day colors: {'passed' if passed else 'FAILED'} ({details})")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
