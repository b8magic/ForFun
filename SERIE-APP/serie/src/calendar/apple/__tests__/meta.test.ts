import type { AppEventMeta } from '../../types';
import {
  base64UrlDecode,
  base64UrlEncode,
  decodeMeta,
  encodeMeta,
  isSerieMetaUrl,
  metaFromUrl,
  metaToUrl,
  notesWithMeta,
  readEventMeta,
  splitNotesMeta,
} from '../meta';

const META: AppEventMeta = {
  v: 1,
  sessionId: '6f1c2b1e-3d4a-4f7e-9b0a-1c2d3e4f5a6b',
  opId: 'op:6f1c2b1e:apple:src-1:cal-1',
  timingState: 'start_only',
  durationSec: null,
  durationSource: null,
  schedulingPlaceholder: true,
};

describe('base64url', () => {
  it('round-trips ASCII and multi-byte text without padding or URL-unsafe characters', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'abcd', '{"k":"v"}', 'Città — più: 🌊 surf', '\u0000\u007f\u0080߿ࠀ￿']) {
      const enc = base64UrlEncode(s);
      expect(enc).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(base64UrlDecode(enc)).toBe(s);
    }
  });

  it('matches RFC 4648 vectors (url alphabet, no padding)', () => {
    expect(base64UrlEncode('foobar')).toBe('Zm9vYmFy');
    expect(base64UrlEncode('fo')).toBe('Zm8');
    expect(base64UrlEncode('ûÿ')).toBe('w7vDvw');
    expect(base64UrlDecode('Zm8=')).toBe('fo');
  });

  it('rejects invalid input', () => {
    expect(base64UrlDecode('a')).toBeNull();
    expect(base64UrlDecode('ab$d')).toBeNull();
    expect(base64UrlDecode('_w')).toBeNull(); // 0xFF is not valid UTF-8
  });
});

describe('AppEventMeta in the URL field', () => {
  it('round-trips through serie://export?m=…', () => {
    const url = metaToUrl(META);
    expect(url.startsWith('serie://export?m=')).toBe(true);
    expect(url).toMatch(/^serie:\/\/export\?m=[A-Za-z0-9_-]+$/);
    expect(metaFromUrl(url)).toEqual(META);
    expect(isSerieMetaUrl(url)).toBe(true);
  });

  it('is deterministic regardless of key order', () => {
    const shuffled = { schedulingPlaceholder: true, durationSource: null, durationSec: null, timingState: 'start_only', opId: META.opId, sessionId: META.sessionId, v: 1 } as AppEventMeta;
    expect(encodeMeta(shuffled)).toBe(encodeMeta(META));
  });

  it('ignores foreign URLs and malformed payloads', () => {
    expect(metaFromUrl('https://example.com/?m=abc')).toBeNull();
    expect(metaFromUrl(null)).toBeNull();
    expect(metaFromUrl('serie://export?m=' + base64UrlEncode('{"v":2}'))).toBeNull();
    expect(metaFromUrl('serie://export?m=' + base64UrlEncode('not json'))).toBeNull();
    expect(isSerieMetaUrl('https://maps.apple.com/?q=La+Fuente')).toBe(false);
  });

  it('validates the shape strictly', () => {
    const bad = [
      { ...META, durationSec: 0 },
      { ...META, durationSec: 1.5 },
      { ...META, timingState: 'all_day' },
      { ...META, durationSource: 'guess' },
      { ...META, opId: '' },
      { ...META, schedulingPlaceholder: 'yes' },
    ];
    for (const b of bad) expect(decodeMeta(base64UrlEncode(JSON.stringify(b)))).toBeNull();
    const ok = { ...META, timingState: 'interval', durationSec: 5400, durationSource: 'interval', schedulingPlaceholder: false };
    expect(decodeMeta(base64UrlEncode(JSON.stringify(ok)))).toEqual(ok);
  });
});

describe('AppEventMeta as a trailing notes line', () => {
  it('appends a delimited last line and strips it on read', () => {
    const notes = notesWithMeta('Onde belle\nvento da terra', META);
    expect(notes.split('\n')).toEqual(['Onde belle', 'vento da terra', '', metaToUrl(META)]);
    expect(splitNotesMeta(notes)).toEqual({ notes: 'Onde belle\nvento da terra', meta: META });
  });

  it('uses only the line when there are no notes, and never duplicates it', () => {
    const once = notesWithMeta(null, META);
    expect(once).toBe(metaToUrl(META));
    const twice = notesWithMeta(notesWithMeta('x', META), { ...META, opId: 'op-2' });
    expect(twice.match(/serie:\/\/export/g)).toHaveLength(1);
    expect(splitNotesMeta(twice).meta?.opId).toBe('op-2');
  });

  it('does not treat a Serie URL in the middle of the notes as metadata', () => {
    const notes = `${metaToUrl(META)}\nscritto dopo`;
    expect(splitNotesMeta(notes)).toEqual({ notes, meta: null });
  });

  it('removes a corrupt trailer instead of leaking it', () => {
    expect(splitNotesMeta('ciao\n\nserie://export?m=AAAA')).toEqual({ notes: 'ciao', meta: null });
  });

  it('prefers the URL field, falls back to notes', () => {
    const other = { ...META, opId: 'from-notes' };
    expect(readEventMeta(metaToUrl(META), notesWithMeta('n', other))).toEqual({ meta: META, notes: 'n', source: 'url' });
    expect(readEventMeta('https://example.com', notesWithMeta('n', other))).toEqual({ meta: other, notes: 'n', source: 'notes' });
    expect(readEventMeta(null, 'solo note')).toEqual({ meta: null, notes: 'solo note', source: null });
  });
});
