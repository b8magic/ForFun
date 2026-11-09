"""Collect every string set in the hand font (class "hand") → tools/hand-text.txt, so tools/build-fonts.py can
subset Caveat Brush to exactly those glyphs. English strings come from src/index.html; their translations come
from every src/i18n/<lang>.json (the dictionary keys are the same units the build translates, with inline tags
as <0>…</0> placeholders, which are dropped here). Re-run `npm run fonts` after changing any .hand text."""
import glob, json, os, re
from html.parser import HTMLParser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = ('br', 'img', 'input', 'source', 'use', 'path', 'rect', 'meta', 'link')
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack = []; self.depth = 0; self.buf = []; self.out = []
    def handle_starttag(self, tag, attrs):
        if tag in SKIP: return
        cls = dict(attrs).get('class') or ''
        self.stack.append('hand' in cls.split())
        if self.stack[-1] and self.depth == 0: self.buf = []
        if self.stack[-1]: self.depth += 1
    def handle_endtag(self, tag):
        if tag in SKIP or not self.stack: return
        if self.stack.pop():
            self.depth -= 1
            if self.depth == 0: self.out.append(' '.join(''.join(self.buf).split()))
    def handle_data(self, d):
        if self.depth: self.buf.append(d)
p = P(); p.feed(open(os.path.join(ROOT, 'src/index.html'), encoding='utf-8').read())
english = sorted(set(p.out))
plain = lambda s: ' '.join(re.sub(r'<\/?\d+\/?>', '', s).replace('&nbsp;', ' ').replace('&amp;', '&').split())
squash = lambda s: re.sub(r'\s+', '', plain(s))  # "the view from<br>our cabins" is read as "the view fromour cabins"
out = list(english)
for f in sorted(glob.glob(os.path.join(ROOT, 'src/i18n/*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    pairs = [(k, v) for k, v in d.get('t', {}).items()] + [(k, k) for k in d.get('keep', [])]
    for h in english:
        found = [plain(v) for k, v in pairs if squash(k) == re.sub(r'\s+', '', h)]
        if not found: raise SystemExit(f'{os.path.basename(f)}: no translation for the hand-written "{h}"')
        out += found
open(os.path.join(ROOT, 'tools/hand-text.txt'), 'w', encoding='utf-8').write('\n'.join(sorted(set(out))) + '\n')
print('\n'.join(sorted(set(out))))
