import {
  baseFromEditedTitle,
  composeTitle,
  effectiveBase,
  resetAllBaseOverrides,
  resetBaseOverride,
  resolveTitle,
  setBaseOverride,
  type BaseTitleOverrides,
} from '../titles';
import { exportOpId, isExportOpId, shortHash, destinationKey } from '../opId';
import { refKey } from '../types';

describe('composeTitle', () => {
  it('is prefix + base + suffix with the user spacing preserved exactly', () => {
    expect(composeTitle({ prefix: '🌊 ', base: 'Surf', suffix: '  · mattina ' })).toBe('🌊 Surf  · mattina ');
    expect(composeTitle({ prefix: '', base: 'Surf', suffix: '' })).toBe('Surf');
    expect(composeTitle({ prefix: '[', base: 'Surf', suffix: ']' })).toBe('[Surf]'); // no automatic separators
    expect(composeTitle({ prefix: '  ', base: 'Surf', suffix: '\t' })).toBe('  Surf\t');
  });
});

describe('resolveTitle / base overrides', () => {
  const cat = 'Surf';

  it('defaults the base to the activity name', () => {
    const r = resolveTitle({ prefix: 'Serie · ', suffix: '', categoryName: cat });
    expect(r).toEqual({ prefix: 'Serie · ', base: 'Surf', suffix: '', final: 'Serie · Surf', overridden: false });
  });

  it('recomputes previews on prefix/suffix changes without re-appending and keeps overrides', () => {
    let overrides: BaseTitleOverrides = {};
    overrides = setBaseOverride(overrides, 's1', 'Surf all’alba', cat);
    const steps: Array<[string, string]> = [
      ['🌊 ', ''],
      ['🌊 ', ' · Lido'],
      ['🏄 ', ' · Lido'],
      ['🏄 ', ' · Lido'], // same settings twice: identical output, nothing appended again
      ['', ''],
    ];
    const finals = steps.map(([prefix, suffix]) => ({
      s1: resolveTitle({ prefix, suffix, categoryName: cat, override: overrides.s1 }).final,
      s2: resolveTitle({ prefix, suffix, categoryName: cat, override: overrides.s2 }).final,
    }));
    expect(finals).toEqual([
      { s1: '🌊 Surf all’alba', s2: '🌊 Surf' },
      { s1: '🌊 Surf all’alba · Lido', s2: '🌊 Surf · Lido' },
      { s1: '🏄 Surf all’alba · Lido', s2: '🏄 Surf · Lido' },
      { s1: '🏄 Surf all’alba · Lido', s2: '🏄 Surf · Lido' },
      { s1: 'Surf all’alba', s2: 'Surf' },
    ]);
    expect(overrides).toEqual({ s1: 'Surf all’alba' }); // batch changes never touched the override map
  });

  it('turns an edited full title back into a base so the batch text is never stored twice', () => {
    const prefix = '🌊 ', suffix = ' · Lido';
    const edited = '🌊 Surf con Luca · Lido';
    const base = baseFromEditedTitle(edited, prefix, suffix);
    expect(base).toBe('Surf con Luca');
    const overrides = setBaseOverride({}, 's1', base, cat);
    expect(resolveTitle({ prefix, suffix, categoryName: cat, override: overrides.s1 }).final).toBe(edited);
    expect(resolveTitle({ prefix: '', suffix: '', categoryName: cat, override: overrides.s1 }).final).toBe('Surf con Luca');
    // Text that no longer carries the batch affixes is kept as typed.
    expect(baseFromEditedTitle('Uscita al tramonto', prefix, suffix)).toBe('Uscita al tramonto');
    expect(baseFromEditedTitle('  spazi  ', '', '')).toBe('  spazi  ');
  });

  it('preserves spacing inside overrides; blank or activity-name overrides mean "no override"', () => {
    expect(effectiveBase(cat, '  Surf lungo ')).toBe('  Surf lungo ');
    expect(effectiveBase(cat, '   ')).toBe('Surf');
    expect(effectiveBase(cat, null)).toBe('Surf');
    const o1 = setBaseOverride({}, 's1', '   ', cat);
    expect(o1).toEqual({});
    const o2 = setBaseOverride({ s1: 'x' }, 's1', 'Surf', cat);
    expect(o2).toEqual({});
  });

  it('reset removes one override without mutating the input; reset-all clears them', () => {
    const before = Object.freeze({ s1: 'Longboard', s2: 'Shortboard' });
    const after = resetBaseOverride(before, 's1');
    expect(after).toEqual({ s2: 'Shortboard' });
    expect(before).toEqual({ s1: 'Longboard', s2: 'Shortboard' });
    expect(resetBaseOverride(after, 'missing')).toBe(after);
    expect(resolveTitle({ prefix: '', suffix: '', categoryName: cat, override: after.s1 })).toMatchObject({ final: 'Surf', overridden: false });
    expect(resetAllBaseOverrides()).toEqual({});
    const set = setBaseOverride(before, 's3', 'Foil', cat);
    expect(set).toEqual({ s1: 'Longboard', s2: 'Shortboard', s3: 'Foil' });
    expect(before).not.toHaveProperty('s3');
  });
});

describe('opId', () => {
  const g = { provider: 'google' as const, accountId: 'a@example.com', calendarId: 'primary' };
  const a = { provider: 'apple' as const, accountId: 'src-1', calendarId: 'cal-1' };

  it('is deterministic per (session, destination) and differs across destinations and sessions', () => {
    expect(exportOpId('s-1', g)).toBe(exportOpId('s-1', { ...g }));
    expect(exportOpId('s-1', g)).not.toBe(exportOpId('s-1', a));
    expect(exportOpId('s-1', g)).not.toBe(exportOpId('s-2', g));
    expect(exportOpId('s-1', g)).not.toBe(exportOpId('s-1', { ...g, calendarId: 'other' }));
    expect(isExportOpId(exportOpId('s-1', g))).toBe(true);
    expect(exportOpId('4f1c2d9e-0000-4000-8000-000000000001', g)).toMatch(/^op1_[A-Za-z0-9-]+_[0-9a-f]{12}$/);
  });

  it('keeps ids distinct when sanitised session ids collide', () => {
    expect(exportOpId('a/b', g)).not.toBe(exportOpId('a:b', g));
  });

  it('shortHash is stable and sized', () => {
    expect(shortHash('serie')).toBe(shortHash('serie'));
    expect(shortHash('serie')).toHaveLength(12);
    expect(shortHash('serie', 16)).toHaveLength(16);
    expect(shortHash('serie', 99)).toHaveLength(16);
    expect(shortHash('serie')).not.toBe(shortHash('seriE'));
    expect(destinationKey(g)).toBe(refKey(g));
  });
});
