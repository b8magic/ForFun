import type { ExternalCalendar } from '../types';
import {
  EQUIVALENCE_STRINGS,
  calendarDetails,
  canonicalEmail,
  classifyEquivalence,
  gateBothDestinations,
  normalizeCalendarTitle,
  pairKey,
  primaryCalendarEmail,
  sameUnderlyingCalendar,
} from '../equivalence';

const EMAIL = 'surfer@gmail.com';

function gcal(p: Partial<ExternalCalendar> = {}): ExternalCalendar {
  return {
    provider: 'google',
    accountId: EMAIL,
    calendarId: 'sport123@group.calendar.google.com',
    accountLabel: EMAIL,
    title: 'Sport',
    color: null,
    access: 'owner',
    canRead: true,
    canWrite: true,
    isPrimary: false,
    sourceType: null,
    sourceName: null,
    ...p,
  };
}

const gPrimary = (p: Partial<ExternalCalendar> = {}) => gcal({ calendarId: EMAIL, title: 'Mario Rossi', isPrimary: true, ...p });

function acal(p: Partial<ExternalCalendar> = {}): ExternalCalendar {
  return {
    provider: 'apple',
    accountId: 'src-google',
    calendarId: 'ek-1',
    accountLabel: p.sourceName ?? EMAIL,
    title: 'Sport',
    color: null,
    access: 'writer',
    canRead: true,
    canWrite: true,
    isPrimary: false,
    sourceType: 'caldav',
    sourceName: EMAIL,
    ...p,
  };
}

describe('normalisation helpers', () => {
  it('normalises titles: case, accents, whitespace', () => {
    expect(normalizeCalendarTitle('  Àllenamenti   Mare ')).toBe('allenamenti mare');
    expect(normalizeCalendarTitle(null)).toBe('');
  });
  it('canonicalises emails case-insensitively; Gmail ignores dots; non-emails are null', () => {
    expect(canonicalEmail('Surfer@Gmail.COM')).toBe(EMAIL);
    expect(canonicalEmail('sur.fer@googlemail.com')).toBe(EMAIL);
    expect(canonicalEmail('a.b@example.com')).toBe('a.b@example.com');
    expect(canonicalEmail('Gmail')).toBeNull();
    expect(canonicalEmail('iCloud')).toBeNull();
    expect(canonicalEmail('')).toBeNull();
  });
  it('only primary calendar ids name an account (group/holiday/import ids do not)', () => {
    expect(primaryCalendarEmail('Sur.fer@gmail.com')).toBe(EMAIL);
    expect(primaryCalendarEmail('mario@azienda.it')).toBe('mario@azienda.it');
    expect(primaryCalendarEmail('abc123@group.calendar.google.com')).toBeNull();
    expect(primaryCalendarEmail('it.italian#holiday@group.v.calendar.google.com')).toBeNull();
    expect(primaryCalendarEmail('xyz@import.calendar.google.com')).toBeNull();
    expect(primaryCalendarEmail('primary')).toBeNull();
  });
});

describe('classifyEquivalence — matrix', () => {
  const cases: Array<[string, ExternalCalendar, ExternalCalendar, 'equivalent' | 'distinct' | 'unknown', string]> = [
    ['CalDAV source = Google email, same title', gcal(), acal(), 'equivalent', 'same_account_same_title'],
    ['email compared case-insensitively, titles normalised', gcal({ title: 'Sport ' }), acal({ sourceName: 'Surfer@Gmail.com', title: 'sport' }), 'equivalent', 'same_account_same_title'],
    ['Gmail dot variant of the account email', gcal(), acal({ sourceName: 'sur.fer@gmail.com' }), 'equivalent', 'same_account_same_title'],
    ['email only in the account label', gcal(), acal({ sourceName: null, accountLabel: EMAIL }), 'equivalent', 'same_account_same_title'],
    ['unknown source type but source named with the email', gcal(), acal({ sourceType: null }), 'equivalent', 'same_account_same_title'],
    ['primary calendar (id = email) seen on iPhone titled with the email', gPrimary(), acal({ title: EMAIL }), 'equivalent', 'primary_email_title'],
    ['primary rule with an iOS source described as "Gmail"', gPrimary(), acal({ title: EMAIL, sourceName: 'Gmail', accountLabel: 'Gmail' }), 'equivalent', 'primary_email_title'],
    ['iCloud through CalDAV, even with the same title', gcal(), acal({ sourceName: 'iCloud', accountLabel: 'iCloud' }), 'distinct', 'apple_icloud'],
    ['legacy MobileMe source', gcal(), acal({ sourceType: 'mobileme', sourceName: 'iCloud' }), 'distinct', 'apple_icloud'],
    ['iPhone-only (local) calendar titled like the Google one', gcal(), acal({ sourceType: 'local', sourceName: 'Default', accountLabel: 'Sul mio iPhone' }), 'distinct', 'apple_local'],
    ['local calendar even when titled with the email', gPrimary(), acal({ sourceType: 'local', sourceName: null, accountLabel: 'Sul mio iPhone', title: EMAIL }), 'distinct', 'apple_local'],
    ['Exchange account of another address', gcal(), acal({ sourceType: 'exchange', sourceName: 'mario@azienda.it' }), 'distinct', 'apple_exchange'],
    ['Exchange account with the Google address (Google Sync)', gcal(), acal({ sourceType: 'exchange', sourceName: EMAIL }), 'unknown', 'exchange_same_email'],
    ['birthdays calendar', gcal(), acal({ sourceType: 'birthdays', sourceName: 'Altro' }), 'distinct', 'apple_birthdays'],
    ['subscribed feed', gcal(), acal({ sourceType: 'subscribed', sourceName: 'Calendari iscritti' }), 'distinct', 'apple_subscribed'],
    ['CalDAV source of another Google account, differently named calendar', gcal(), acal({ sourceName: 'other@gmail.com', title: 'Lavoro' }), 'distinct', 'apple_other_account'],
    // Regression: a calendar shared between two Google accounts is ONE calendar; a matching name is not "clearly different".
    ['another Google account with a calendar of the same name (maybe shared)', gcal(), acal({ sourceName: 'other@gmail.com' }), 'unknown', 'other_account_same_title'],
    ['another account’s primary shared with the Google account, seen on iPhone in its own account', gcal({ calendarId: 'other@gmail.com', title: 'Luca' }), acal({ sourceName: 'other@gmail.com', title: 'other@gmail.com' }), 'equivalent', 'primary_email_title'],
    ['a shared primary seen on iPhone through a third account', gcal({ calendarId: 'other@gmail.com', title: 'Luca' }), acal({ sourceName: 'third@gmail.com', title: 'other@gmail.com' }), 'unknown', 'other_account_same_title'],
    ['a shared primary seen on iPhone through the same account', gcal({ calendarId: 'other@gmail.com', title: 'Luca' }), acal({ title: 'other@gmail.com' }), 'equivalent', 'primary_email_title'],
    ['a group calendar id is not an account email', gcal({ calendarId: 'abc@group.calendar.google.com' }), acal({ sourceName: 'Gmail', accountLabel: 'Gmail', title: 'abc@group.calendar.google.com' }), 'unknown', 'apple_source_unidentified'],
    ['same account: iPhone shows the primary (email title), Google side is a secondary calendar', gcal(), acal({ title: EMAIL }), 'distinct', 'other_calendar_same_account'],
    ['same account, different title, no other information', gcal(), acal({ title: 'Allenamenti' }), 'unknown', 'same_account_title_mismatch'],
    ['source described as "Gmail" (no email), same title', gcal(), acal({ sourceName: 'Gmail', accountLabel: 'Gmail' }), 'unknown', 'apple_source_unidentified'],
    ['custom account description on iOS', gcal(), acal({ sourceName: 'Lavoro', accountLabel: 'Lavoro' }), 'unknown', 'apple_source_unidentified'],
    ['Google account email missing', gcal({ accountId: 'acc-1', accountLabel: 'Account' }), acal(), 'unknown', 'missing_details'],
  ];

  it.each(cases)('%s', (_name, g, a, verdict, reason) => {
    const r = classifyEquivalence(g, a);
    expect(r.verdict).toBe(verdict);
    expect(r.reason).toBe(reason);
    expect(r.detail).toBe(EQUIVALENCE_STRINGS.reasons[r.reason as keyof typeof EQUIVALENCE_STRINGS.reasons]);
  });

  it('is symmetric in argument order', () => {
    for (const [, g, a] of cases) expect(classifyEquivalence(a, g)).toEqual(classifyEquivalence(g, a));
  });

  it('uses the account calendar list to tell another calendar from a rename', () => {
    const sport = gcal();
    const training = gcal({ calendarId: 'train@group.calendar.google.com', title: 'Allenamenti' });
    const ctx = { googleCalendars: [gPrimary(), sport, training] };
    // iPhone "Allenamenti" is clearly the other Google calendar.
    expect(classifyEquivalence(sport, acal({ title: 'Allenamenti' }), ctx)).toMatchObject({ verdict: 'distinct', reason: 'other_calendar_same_account' });
    // No Google calendar carries that title: maybe renamed → unknown.
    expect(classifyEquivalence(sport, acal({ title: 'Vecchio nome' }), ctx)).toMatchObject({ verdict: 'unknown', reason: 'same_account_title_mismatch' });
    // Two Google calendars share the title → cannot tell which one iOS shows.
    const twin = gcal({ calendarId: 'twin@group.calendar.google.com', title: 'sport' });
    expect(classifyEquivalence(sport, acal(), { googleCalendars: [sport, twin] })).toMatchObject({ verdict: 'unknown', reason: 'same_account_title_ambiguous' });
    // Another account's calendar with the same title does not create ambiguity.
    const foreign = gcal({ accountId: 'other@gmail.com', accountLabel: 'other@gmail.com', calendarId: 'x@group.calendar.google.com' });
    expect(classifyEquivalence(sport, acal(), { googleCalendars: [sport, foreign] }).verdict).toBe('equivalent');
  });

  it('carries display details for both sides', () => {
    const r = classifyEquivalence(gcal(), acal({ sourceName: 'Gmail', accountLabel: 'Gmail' }));
    expect(r.details.google).toMatchObject({ provider: 'google', providerLabel: 'Google Calendar', accountLabel: EMAIL, calendarTitle: 'Sport', sourceType: null });
    expect(r.details.apple).toMatchObject({ provider: 'apple', providerLabel: 'Calendari di iPhone', accountLabel: 'Gmail', calendarTitle: 'Sport', sourceType: 'caldav', sourceName: 'Gmail' });
    expect(calendarDetails(gcal()).calendarId).toBe('sport123@group.calendar.google.com');
  });

  it('rejects two calendars of the same provider', () => {
    expect(() => classifyEquivalence(gcal(), gcal())).toThrow();
  });
});

describe('sameUnderlyingCalendar', () => {
  it('compares calendar ids within one provider and classifies across providers', () => {
    expect(sameUnderlyingCalendar(gcal(), gcal({ accountId: 'other@gmail.com' }))).toBe('equivalent'); // shared calendar seen from two accounts
    expect(sameUnderlyingCalendar(gcal(), gPrimary())).toBe('distinct');
    expect(sameUnderlyingCalendar(acal(), acal())).toBe('equivalent');
    expect(sameUnderlyingCalendar(acal(), acal({ calendarId: 'ek-2' }))).toBe('distinct');
    expect(sameUnderlyingCalendar(acal(), gcal())).toBe('equivalent');
    expect(sameUnderlyingCalendar(gcal(), acal({ sourceType: 'local' }))).toBe('distinct');
  });
});

describe('gateBothDestinations — the "Both" rule', () => {
  it('blocks equivalent destinations even when the user tried to resolve', () => {
    for (const res of [null, 'resolved_distinct'] as const) {
      const g = gateBothDestinations(gcal(), acal(), res);
      expect(g.allowed).toBe(false);
      if (!g.allowed) {
        expect(g.code).toBe('equivalent');
        expect(g.message).toBe('Questi due calendari sembrano lo stesso calendario visto da due percorsi. Scegline uno per evitare doppioni.');
      }
    }
  });

  it('requires an explicit resolution when equivalence is unknown, and shows the details', () => {
    const apple = acal({ sourceName: 'Gmail', accountLabel: 'Gmail' });
    const blocked = gateBothDestinations(gcal(), apple, null);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.code).toBe('unresolved');
      expect(blocked.message).toBe(EQUIVALENCE_STRINGS.unknown);
      expect(blocked.equivalence.details.apple.accountLabel).toBe('Gmail');
      expect(blocked.equivalence.details.google.accountLabel).toBe(EMAIL);
    }
    const ok = gateBothDestinations(gcal(), apple, 'resolved_distinct');
    expect(ok).toMatchObject({ allowed: true, resolvedByUser: true });
  });

  it('allows clearly distinct destinations without asking', () => {
    const g = gateBothDestinations(gcal(), acal({ sourceName: 'iCloud', accountLabel: 'iCloud' }), null);
    expect(g).toMatchObject({ allowed: true, resolvedByUser: false, message: EQUIVALENCE_STRINGS.distinct });
  });
});

describe('pairKey', () => {
  it('is stable and specific to both calendars', () => {
    const g = { provider: 'google' as const, accountId: EMAIL, calendarId: 'c1' };
    const a = { provider: 'apple' as const, accountId: 'src', calendarId: 'ek-1' };
    expect(pairKey(g, a)).toBe(`google:${EMAIL}:c1|apple:src:ek-1`);
    expect(pairKey(g, { ...a, calendarId: 'ek-2' })).not.toBe(pairKey(g, a));
  });
});
