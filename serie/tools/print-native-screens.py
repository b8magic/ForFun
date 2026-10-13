#!/usr/bin/env python3
"""Keep a few small native QA previews readable through the Actions logs API.

The complete originals stay in the smoke-test artifact. This is diagnostic
output only and never changes the app, fixture, or pass/fail outcome.
"""
import base64
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = (
    "fail-01-log.png",
    "fail-native-upgrade.png",
    "fail-02-details-map.png",
    "fail-03-calendar.png",
    "fail-04-settings-periods.png",
    "01-log--02-notes-keyboard.png",
    "01-log--03-mixed-colors-native.png",
    "01-log--06-history-year.png",
    "04-settings-periods--32-period-preview.png",
    "04-settings-periods--31-dark-after-restart.png",
    "04-settings-periods--34-day-after-edit.png",
    "00-launch.png",
)


def main():
    root = Path(sys.argv[1]).resolve(strict=True)
    names = list(NAMES)
    if (root / "fail-01-log.png").is_file():
        names.insert(1, "01-log--03-surf-before-restart.png")
    paths = [root / name for name in names if (root / name).is_file()][:6]
    with tempfile.TemporaryDirectory(prefix="serie-native-previews-") as temp:
        for index, path in enumerate(paths):
            target = Path(temp) / f"{index}.png"
            try:
                for dimension in (960, 720):
                    subprocess.run(
                        ["sips", "-Z", str(dimension), str(path), "--out", str(target)],
                        check=True, capture_output=True, timeout=30,
                    )
                    data = target.read_bytes()
                    if len(data) <= 180_000:
                        break
                else:
                    print(f"Native preview omitted (large): {path.name}", flush=True)
                    continue
                digest = hashlib.sha256(data).hexdigest()
                print(f"SERIE_NATIVE_SCREEN_BEGIN {path.name} sha256={digest}", flush=True)
                encoded = base64.b64encode(data).decode("ascii")
                for offset in range(0, len(encoded), 96):
                    print(encoded[offset:offset + 96], flush=True)
                print("SERIE_NATIVE_SCREEN_END", flush=True)
            except (OSError, subprocess.SubprocessError) as error:
                print(f"Native preview unavailable: {path.name}: {error}", flush=True)


if __name__ == "__main__":
    main()
