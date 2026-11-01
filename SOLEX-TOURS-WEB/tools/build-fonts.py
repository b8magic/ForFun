"""Self-hosted font subsets for the site (run once; output is committed in src/assets/fonts).

    python3 tools/build-fonts.py

Sources: npm @fontsource-variable/fraunces, @fontsource-variable/figtree, @fontsource/caveat-brush
(all SIL OFL). Fraunces is instanced to SOFT=100, WONK=0 (roman keeps wght 700–800 at opsz 72 —
the opsz axis would double the file;
the italic is a static 600 at opsz 96). Everything is subset to Latin-1 plus the typographic marks
the copy uses.
"""
import os, subprocess, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM = os.path.join(ROOT, 'node_modules')
OUT = os.path.join(ROOT, 'src/assets/fonts')
os.makedirs(OUT, exist_ok=True)
TEXT_UNI = 'U+0020-007E,U+00A0,U+00A1,U+00A9,U+00B7,U+00BF,U+00C1,U+00C9,U+00CD,U+00D1,U+00D3,U+00DA,U+00E1,U+00E9,U+00ED,U+00F1,U+00F3,U+00FA,U+00FC,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2032,U+2033,U+2190-2193,U+2248,U+00D7,U+2713,U+2605,U+20AC'
# Caveat Brush is only used for a handful of short notes: subset to exactly the glyphs they need.
HAND_TEXT = open(os.path.join(ROOT, 'tools/hand-text.txt'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, 'tools/hand-text.txt')) else None
HAND_UNI = 'U+0020-007E,U+00A1,U+2019,U+201C,U+201D,U+2026'

def subset(src, dst, unicodes, extra=()):
    subprocess.run([sys.executable, '-m', 'fontTools.subset', src, f'--unicodes={unicodes}', '--flavor=woff2',
                    '--layout-features=kern,liga,lnum,tnum,pnum,onum,case', '--no-hinting', '--desubroutinize',
                    f'--output-file={dst}', *extra], check=True)
    print(f'{os.path.basename(dst):28} {os.path.getsize(dst):>7} B')

def instance(src, axes, tmp):
    f = TTFont(src)
    instancer.instantiateVariableFont(f, axes, inplace=True)
    f.flavor = None
    f.save(tmp)
    return tmp

fr = os.path.join(NM, '@fontsource-variable/fraunces/files')
subset(instance(f'{fr}/fraunces-latin-full-normal.woff2', {'SOFT': 100, 'WONK': 0, 'wght': (700, 800), 'opsz': 72}, '/tmp/fr-roman.ttf'),
       f'{OUT}/fraunces-roman.woff2', TEXT_UNI)
subset(instance(f'{fr}/fraunces-latin-full-italic.woff2', {'SOFT': 100, 'WONK': 0, 'wght': 600, 'opsz': 96}, '/tmp/fr-italic.ttf'),
       f'{OUT}/fraunces-italic-600.woff2', TEXT_UNI)
subset(instance(os.path.join(NM, '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2'), {'wght': (400, 800)}, '/tmp/figtree.ttf'),
       f'{OUT}/figtree-var.woff2', TEXT_UNI)
hand_src = os.path.join(NM, '@fontsource/caveat-brush/files/caveat-brush-latin-400-normal.woff2')
if HAND_TEXT:
    chars = ''.join(sorted(set(HAND_TEXT.replace('\n', ' ')) | set(' .,!?¡’“”…')))
    subset(hand_src, f'{OUT}/caveat-brush.woff2', ','.join(f'U+{ord(c):04X}' for c in chars))
else:
    subset(hand_src, f'{OUT}/caveat-brush.woff2', HAND_UNI)
