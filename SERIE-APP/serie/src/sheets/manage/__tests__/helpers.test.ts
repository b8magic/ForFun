import type { Category, PatternKind } from '@/domain/types';
import { mkSession } from '@/test/factories';
import { t } from '@/i18n/it';
import {
  NAME_MAX,
  countByCategory,
  errorCode,
  errorText,
  isFutureMonth,
  isNameCode,
  jumpYears,
  monthCounts,
  moveId,
  moveTargets,
  nameIssue,
  parseJumpTarget,
  parseMonthKey,
  suggestLook,
  yearCounts,
 ALL_ACTIVITIES, monthCounts as mc, yearCounts as yc, jumpYears as jy } from '../helpers';


const cat = (id: string, name: string, color = '#FF4D1F', pattern: PatternKind = 'swell', sortOrder = 0): Category => ({
  id,
  name,
  color,
  pattern,
  sortOrder,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const cats = [cat('surf', 'Surf'), cat('run', 'Corsa', '#C9F06A', 'stride', 1)];

describe('nameIssue (mirror of the repository rule)', () => {
  it('requires a non-blank name', () => {
    expect(nameIssue('', cats)).toBe('name_required');
    expect(nameIssue('   ', cats)).toBe('name_required');
  });
  it('limits the trimmed length to 40 characters', () => {
    expect(nameIssue('a'.repeat(NAME_MAX), cats)).toBeNull();
    expect(nameIssue(`  ${'a'.repeat(NAME_MAX)}  `, cats)).toBeNull();
    expect(nameIssue('a'.repeat(NAME_MAX + 1), cats)).toBe('name_too_long');
  });
  it('is unique case-insensitively, ignoring surrounding spaces', () => {
    expect(nameIssue('surf', cats)).toBe('name_taken');
    expect(nameIssue('  CORSA ', cats)).toBe('name_taken');
    expect(nameIssue('Nuoto', cats)).toBeNull();
  });
  it('lets an activity keep (or re-case) its own name', () => {
    expect(nameIssue('SURF', cats, 'surf')).toBeNull();
    expect(nameIssue('Corsa', cats, 'surf')).toBe('name_taken');
  });
});

describe('error copy', () => {
  it('maps DomainError codes to Italian messages', () => {
    expect(errorText({ code: 'name_required' })).toBe(t.nameRequired);
    expect(errorText({ code: 'name_taken' })).toBe(t.nameTaken);
    expect(errorText({ code: 'name_too_long' })).toBe(t.manage.nameTooLong);
    expect(errorText({ code: 'category_has_sessions' })).toBe(t.manage.errHasSessions);
    expect(errorText({ code: 'move_to_same' })).toBe(t.manage.errMoveSame);
    expect(errorText({ code: 'category_missing' })).toBe(t.manage.errMissing);
  });
  it('falls back to the generic message for anything else', () => {
    expect(errorText(new Error('disk full'))).toBe(t.errorGeneric);
    expect(errorText(null)).toBe(t.errorGeneric);
    expect(errorText({ code: 42 })).toBe(t.errorGeneric);
  });
  it('reads codes and recognises name errors', () => {
    expect(errorCode({ code: 'name_taken' })).toBe('name_taken');
    expect(errorCode('move_to_same')).toBe('move_to_same');
    expect(errorCode(undefined)).toBeNull();
    expect(isNameCode('name_too_long')).toBe(true);
    expect(isNameCode('category_missing')).toBe(false);
    expect(isNameCode(null)).toBe(false);
  });
});

describe('counts and ordering', () => {
  it('counts sessions per activity from the stored sessions', () => {
    const m = countByCategory([mkSession({ date: '2026-10-01', categoryId: 'surf' }), mkSession({ date: '2026-10-01', categoryId: 'surf' }), mkSession({ date: '2026-10-02', categoryId: 'run' })]);
    expect(m.get('surf')).toBe(2);
    expect(m.get('run')).toBe(1);
    expect(m.get('none')).toBeUndefined();
  });
  it('moves one step up or down, never past the ends', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toBeNull();
    expect(moveId(['a', 'b', 'c'], 'c', 1)).toBeNull();
    expect(moveId(['a', 'b'], 'x', 1)).toBeNull();
  });
  it('never offers the activity being deleted as a move target', () => {
    expect(moveTargets(cats, 'surf').map((c) => c.id)).toEqual(['run']);
    expect(moveTargets([cats[0]], 'surf')).toEqual([]);
  });
  it('suggests the first unused colour and pattern', () => {
    const palette = [{ hex: '#FF4D1F' }, { hex: '#C9F06A' }, { hex: '#B9A8FF' }];
    expect(suggestLook(cats, palette)).toEqual({ color: '#B9A8FF', pattern: 'pulse' });
    expect(suggestLook([], palette)).toEqual({ color: '#FF4D1F', pattern: 'swell' });
    const all = (['swell', 'stride', 'pulse', 'drift', 'ripple', 'grain'] as PatternKind[]).map((p, i) => cat(`c${i}`, `N${i}`, palette[i % 3].hex.toLowerCase(), p));
    expect(suggestLook(all, palette)).toEqual({ color: '#FF4D1F', pattern: 'swell' });
  });
});

describe('month jump', () => {
  const sessions = [
    mkSession({ date: '2024-03-10', categoryId: 'surf' }),
    mkSession({ date: '2024-03-11', categoryId: 'surf' }),
    mkSession({ date: '2026-10-05', categoryId: 'surf' }),
    mkSession({ date: '2021-01-01', categoryId: 'run' }),
  ];
  it('reads the target param, defaulting to the lineup', () => {
    expect(parseJumpTarget(undefined)).toBe('lineup');
    expect(parseJumpTarget('history')).toBe('history');
    expect(parseJumpTarget(['history'])).toBe('history');
    expect(parseJumpTarget('anything')).toBe('lineup');
  });
  it('offers years from the first session of the active activity to the current year', () => {
    expect(jumpYears(sessions, 'surf', '2026-10-11')).toEqual([2024, 2025, 2026]);
    expect(jumpYears(sessions, 'run', '2026-10-11')).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(jumpYears(sessions, 'swim', '2026-10-11')).toEqual([2026]);
    expect(jumpYears(sessions, null, '2026-10-11')).toEqual([2026]);
  });
  it('keeps the year in view reachable and prepends years on request', () => {
    expect(jumpYears(sessions, 'swim', '2026-10-11', { include: 2025 })).toEqual([2025, 2026]);
    expect(jumpYears(sessions, 'surf', '2026-10-11', { include: 2026 })).toEqual([2024, 2025, 2026]);
    expect(jumpYears(sessions, 'surf', '2026-10-11', { earlier: 2 })).toEqual([2022, 2023, 2024, 2025, 2026]);
  });
  it('never lists years after the current one', () => {
    expect(jumpYears([mkSession({ date: '2027-01-01', categoryId: 'surf' })], 'surf', '2026-10-11')).toEqual([2026]);
  });
  it('counts sessions per month and per year for the activity only', () => {
    const m = monthCounts(sessions, 'surf', 2024);
    expect(m).toHaveLength(12);
    expect(m[2]).toBe(2);
    expect(m.reduce((a, b) => a + b, 0)).toBe(2);
    expect(monthCounts(sessions, 'surf', 2026)[9]).toBe(1);
    expect(monthCounts(sessions, null, 2024).every((n) => n === 0)).toBe(true);
    const y = yearCounts(sessions, 'surf');
    expect(y.get(2024)).toBe(2);
    expect(y.get(2026)).toBe(1);
    expect(y.get(2021)).toBeUndefined();
  });
  it('disables months after the current month', () => {
    expect(isFutureMonth({ y: 2026, m: 10 }, '2026-10-11')).toBe(false);
    expect(isFutureMonth({ y: 2026, m: 11 }, '2026-10-11')).toBe(true);
    expect(isFutureMonth({ y: 2027, m: 1 }, '2026-12-31')).toBe(true);
    expect(isFutureMonth({ y: 2025, m: 12 }, '2026-01-01')).toBe(false);
  });
  it('parses month keys', () => {
    expect(parseMonthKey('2026-03')).toEqual({ y: 2026, m: 3 });
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('2026-3')).toBeNull();
    expect(parseMonthKey(null)).toBeNull();
  });
});

describe('jump counts for every activity (history filter "Tutte")', () => {
  it('counts sessions of all activities', () => {
    const ss = [
      { categoryId: 'a', date: '2024-03-02' },
      { categoryId: 'b', date: '2024-03-09' },
      { categoryId: 'b', date: '2025-01-01' },
    ];
    expect(mc(ss, ALL_ACTIVITIES, 2024)[2]).toBe(2);
    expect(yc(ss, ALL_ACTIVITIES).get(2025)).toBe(1);
    expect(jy(ss, ALL_ACTIVITIES, '2026-10-11')[0]).toBe(2024);
    expect(mc(ss, null, 2024)[2]).toBe(0);
  });
});
