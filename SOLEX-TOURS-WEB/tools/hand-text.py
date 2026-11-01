"""Collect every string set in the hand font (class "hand") → tools/hand-text.txt,
so tools/build-fonts.py can subset Caveat Brush to exactly those glyphs."""
import os
from html.parser import HTMLParser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack = []; self.depth = 0; self.buf = []; self.out = []
    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'img', 'input', 'source', 'use', 'path', 'rect', 'meta', 'link'): return
        cls = dict(attrs).get('class') or ''
        self.stack.append('hand' in cls.split())
        if self.stack[-1] and self.depth == 0: self.buf = []
        if self.stack[-1]: self.depth += 1
    def handle_endtag(self, tag):
        if tag in ('br', 'img', 'input', 'source', 'use', 'path', 'rect', 'meta', 'link') or not self.stack: return
        if self.stack.pop():
            self.depth -= 1
            if self.depth == 0: self.out.append(' '.join(''.join(self.buf).split()))
    def handle_data(self, d):
        if self.depth: self.buf.append(d)
p = P(); p.feed(open(os.path.join(ROOT, 'src/index.html'), encoding='utf-8').read())
open(os.path.join(ROOT, 'tools/hand-text.txt'), 'w', encoding='utf-8').write('\n'.join(sorted(set(p.out))) + '\n')
print('\n'.join(sorted(set(p.out))))
