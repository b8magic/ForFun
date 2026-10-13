#!/usr/bin/env python3
"""In-memory decoder/guard unit tests; never create screenshot evidence."""
import importlib.util
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

SCRIPT = Path(__file__).with_name("check-native-colors.py")
SPEC = importlib.util.spec_from_file_location("native_colors", SCRIPT)
colors = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = colors
sys.dont_write_bytecode = True
SPEC.loader.exec_module(colors)


def chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(
        ">I", zlib.crc32(kind + payload) & 0xFFFFFFFF,
    )


def png_bytes(width, height, raw, channels=3, depth=8, interlace=0):
    header = struct.pack(">IIBBBBB", width, height, depth, 2 if channels == 3 else 6, 0, 0, interlace)
    compressed = zlib.compress(raw)
    # Native screenshots may split the compressed stream across IDAT chunks.
    midpoint = len(compressed) // 2
    return colors.PNG_SIGNATURE + chunk(b"IHDR", header) + chunk(
        b"IDAT", compressed[:midpoint],
    ) + chunk(b"IDAT", compressed[midpoint:]) + chunk(b"IEND", b"")


class DecoderTests(unittest.TestCase):
    def test_every_rgb_and_rgba_filter_with_wraparound(self):
        # Known encoded rows, rather than a second implementation of the decoder.
        expected = {
            3: ((10, 20, 30, 40, 50, 60), (15, 18, 250, 200, 100, 0)),
            4: ((10, 20, 30, 255, 40, 50, 60, 128), (15, 18, 250, 250, 200, 100, 0, 20)),
        }
        encoded = {
            3: (
                expected[3],
                ((10, 20, 30, 30, 30, 30), (15, 18, 250, 185, 82, 6)),
                (expected[3][0], (5, 254, 220, 160, 50, 196)),
                ((10, 20, 30, 35, 40, 45), (10, 8, 235, 173, 66, 101)),
                ((10, 20, 30, 30, 30, 30), (5, 254, 220, 160, 50, 6)),
            ),
            4: (
                expected[4],
                ((10, 20, 30, 255, 30, 30, 30, 129), (15, 18, 250, 250, 185, 82, 6, 26)),
                (expected[4][0], (5, 254, 220, 251, 160, 50, 196, 148)),
                ((10, 20, 30, 255, 35, 40, 45, 1), (10, 8, 235, 123, 173, 66, 101, 87)),
                ((10, 20, 30, 255, 30, 30, 30, 129), (5, 254, 220, 251, 160, 50, 6, 148)),
            ),
        }
        for channels in (3, 4):
            for filter_type, rows in enumerate(encoded[channels]):
                with self.subTest(channels=channels, filter_type=filter_type):
                    raw = b"".join(bytes([filter_type]) + bytes(row) for row in rows)
                    raster = colors.decode_png(png_bytes(2, 2, raw, channels))
                    self.assertEqual((raster.width, raster.height, raster.channels), (2, 2, channels))
                    self.assertEqual(raster.pixels, bytes(expected[channels][0] + expected[channels][1]))

    def test_rejects_corruption_and_unsupported_formats(self):
        good = png_bytes(1, 1, b"\0\x01\x02\x03")
        invalid = (
            good[:-5],
            good[:30] + bytes([good[30] ^ 1]) + good[31:],
            png_bytes(1, 1, b"\0\x01\x02\x03", depth=16),
            png_bytes(1, 1, b"\0\x01\x02\x03", interlace=1),
            png_bytes(1, 1, b"\x05\x01\x02\x03"),
            png_bytes(1, 1, b"\0\x01\x02"),
            png_bytes(1, 1, b"\0\x01\x02\x03\x04"),
            png_bytes(100000, 100000, b"\0\x01\x02\x03"),
        )
        for data in invalid:
            with self.subTest(data=data[:40]):
                with self.assertRaises(ValueError):
                    colors.decode_png(data)


def raster_with_days(days, scale=1, alpha=None):
    width, height = 400 * scale, 800 * scale
    channels = 3 if alpha is None else 4
    background = (246, 242, 233) + (() if alpha is None else (255,))
    pixels = bytearray(bytes(background) * width * height)
    for left, top, red, lime, side in days:
        for y in range(side * scale):
            for x in range(side * scale):
                color = red if x + y < side * scale else lime
                color = color + (() if alpha is None else (alpha,))
                offset = ((top * scale + y) * width + left * scale + x) * channels
                pixels[offset:offset + channels] = bytes(color)
    return colors.Raster(width, height, channels, bytes(pixels))


class CalendarGuardTests(unittest.TestCase):
    def test_same_day_matches_without_a_fixed_month_row_and_at_2x(self):
        for scale, left, top in ((1, 160, 200), (1, 48, 500), (2, 272, 360)):
            with self.subTest(scale=scale, left=left, top=top):
                raster = raster_with_days([(left, top, colors.RED, colors.MUTED_LIME, 44)], scale)
                passed, details = colors.inspect_colors(raster)
                self.assertTrue(passed, details)
                self.assertIn("same-day=yes", details)

    def test_stale_salmon_and_unmuted_lime_fail(self):
        for wrong_color in ((250, 164, 138), (201, 240, 106)):
            raster = raster_with_days([(160, 260, colors.RED, wrong_color, 44)])
            passed, details = colors.inspect_colors(raster)
            self.assertFalse(passed, details)
            self.assertIn("muted-lime=0", details)

    def test_colors_on_neighboring_dates_do_not_satisfy_the_guard(self):
        raster = raster_with_days([
            (160, 260, colors.RED, colors.RED, 44),
            (216, 260, colors.MUTED_LIME, colors.MUTED_LIME, 44),
        ])
        passed, details = colors.inspect_colors(raster)
        self.assertFalse(passed, details)
        self.assertNotIn("red=0", details)
        self.assertNotIn("muted-lime=0", details)

    def test_header_and_dock_do_not_satisfy_the_guard(self):
        raster = raster_with_days([
            (160, 24, colors.RED, colors.MUTED_LIME, 44),
            (160, 700, colors.RED, colors.MUTED_LIME, 44),
        ])
        passed, details = colors.inspect_colors(raster)
        self.assertFalse(passed, details)
        self.assertIn("red=0", details)
        self.assertIn("muted-lime=0", details)

    def test_tiny_and_transparent_color_patches_fail(self):
        for side, alpha in ((8, None), (44, 100)):
            raster = raster_with_days([(160, 260, colors.RED, colors.MUTED_LIME, side)], alpha=alpha)
            passed, details = colors.inspect_colors(raster)
            self.assertFalse(passed, details)

    def test_opaque_rgba_and_small_color_variance_pass(self):
        raster = raster_with_days([(160, 260, (251, 81, 35), (221, 245, 177), 44)], alpha=255)
        passed, details = colors.inspect_colors(raster)
        self.assertTrue(passed, details)

    def test_missing_screenshot_exits_nonzero(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "01-log--03-mixed-colors-native.png"
            result = subprocess.run([sys.executable, str(SCRIPT), str(missing)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("FAILED", result.stdout)
        self.assertIn(missing.name, result.stdout)


if __name__ == "__main__":
    unittest.main()
