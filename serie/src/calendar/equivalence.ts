/**
 * Destination equivalence: is a Google calendar the same underlying calendar
 * as an iPhone (EventKit) calendar?
 *
 * A Google account added to iOS shows its calendars in the iPhone calendar
 * store through CalDAV. Writing the same session through Google Calendar AND
 * through EventKit into that calendar would create two events, so "Both" must
 * never double-write. This module decides, from the calendar descriptors only:
 *
 *   equivalent  the iPhone calendar comes from a CalDAV source whose name is
 *               the Google account email (case-insensitive) AND the calendar
 *               titles match after normalisation; or the Google calendar is the
 *               account's primary calendar (id = account email) and the iPhone
 *               calendar is titled with that email.
 *   distinct    clearly different storage: iPhone-only (local), iCloud,
 *               Exchange, birthdays, subscribed feeds, a CalDAV source of
 *               another account, or another calendar of the same account.
 *   unknown     cannot be established (e.g. the iOS account is described as
 *               "Gmail" or a custom name, or the same account shows a different
 *               title that may be a rename). The user must resolve it.
 *
 * `gateBothDestinations` turns a verdict into the "Both" rule: equivalent →
 * blocked (choose one route); unknown → blocked until the user explicitly
 * confirms the pair as distinct; distinct → allowed. Every result carries the
 * account/calendar details to display.
 *
 * Pure: no React, no Expo.
 */
import { refKey, type CalendarRef, type ExternalCalendar, type ProviderKind } from './types';
import { t } from '@/i18n/it';

// ─── strings (Italian) ───────────────────────────────────────────────────────

export const EQUIVALENCE_STRINGS = {
  equivalent: t.equivalentWarning,
  unknown: t.equivalenceUnknown,
  distinct: 'Sono calendari diversi: puoi esportare su entrambi.',
  resolvedDistinct: 'Hai confermato che sono calendari diversi.',
  reasons: {
    same_calendar: 'È lo stesso calendario.',
    same_provider_other_calendar: 'Sono due calendari diversi dello stesso servizio.',
    same_account_same_title: 'Stesso account Google e stesso nome del calendario.',
    primary_email_title: 'È il calendario principale dell’account Google, visto da iPhone.',
    apple_local: 'Il calendario di iPhone è solo sul dispositivo.',
    apple_icloud: 'Il calendario di iPhone è su iCloud, non su Google.',
    apple_exchange: 'Il calendario di iPhone è su un account Exchange.',
    apple_birthdays: 'Il calendario di iPhone è quello dei compleanni.',
    apple_subscribed: 'Il calendario di iPhone è un calendario iscritto, di sola lettura.',
    apple_other_account: 'Il calendario di iPhone appartiene a un altro account.',
    other_calendar_same_account: 'Stesso account Google, ma un altro calendario.',
    same_account_title_mismatch: 'Stesso account Google, ma con un nome diverso: potrebbe essere stato rinominato.',
    same_account_title_ambiguous: 'Più calendari Google hanno questo nome.',
    exchange_same_email: 'Account Exchange con lo stesso indirizzo dell’account Google.',
    apple_source_unidentified: 'Su iPhone l’account non mostra l’indirizzo Google.',
    missing_details: 'Mancano i dettagli dell’account.',
  },
} as const;

// ─── types ───────────────────────────────────────────────────────────────────

export type EquivalenceVerdict = 'equivalent' | 'distinct' | 'unknown';

export type EquivalenceReason = keyof typeof EQUIVALENCE_STRINGS.reasons;

/** What the UI shows for each side when asking the user to resolve. */
export interface CalendarDetails {
  provider: ProviderKind;
  /** "Google Calendar" | "Calendari di iPhone". */
  providerLabel: string;
  accountId: string;
  accountLabel: string;
  calendarId: string;
  calendarTitle: string;
  isPrimary: boolean;
  /** Apple only: EventKit source type and name. */
  sourceType: string | null;
  sourceName: string | null;
}

export interface EquivalenceResult {
  verdict: EquivalenceVerdict;
  reason: EquivalenceReason;
  /** Headline (Italian): equivalent / unknown / distinct. */
  message: string;
  /** Why (Italian), from `reason`. */
  detail: string;
  details: { google: CalendarDetails; apple: CalendarDetails };
}

export interface EquivalenceContext {
  /**
   * Every calendar of the Google account(s), when available. Used to tell
   * "another calendar of the same account" from "possibly renamed", and to
   * detect titles shared by several Google calendars.
   */
  googleCalendars?: readonly ExternalCalendar[];
}

export type BothResolution = 'resolved_distinct' | null;

export type BothGate =
  | { allowed: true; equivalence: EquivalenceResult; resolvedByUser: boolean; message: string }
  | {
      allowed: false;
      /** equivalent → choose one route; unresolved → the user must confirm the pair. */
      code: 'equivalent' | 'unresolved';
      message: string;
      equivalence: EquivalenceResult;
    };

// ─── normalisation ───────────────────────────────────────────────────────────

/** Casefold, strip accents, collapse whitespace. Keeps punctuation (emails stay readable). */
export function normalizeCalendarTitle(s: string | null | undefined): string {
  if (!s) return '';
  let x = s;
  try {
    x = x.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  } catch {
    /* runtime without normalize: keep accents */
  }
  return x.toLowerCase().replace(/\s+/g, ' ').trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Canonical email for comparison, or null when the text is not an email.
 * Case-insensitive; Gmail ignores dots in the local part and `googlemail.com`
 * is the same domain as `gmail.com`.
 */
export function canonicalEmail(s: string | null | undefined): string | null {
  const x = (s ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(x)) return null;
  const at = x.lastIndexOf('@');
  let local = x.slice(0, at);
  let domain = x.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

type AppleSourceKind = 'local' | 'icloud' | 'exchange' | 'birthdays' | 'subscribed' | 'caldav' | 'unknown';

function appleSourceKind(cal: ExternalCalendar): AppleSourceKind {
  const type = (cal.sourceType ?? '').trim().toLowerCase();
  const name = normalizeCalendarTitle(cal.sourceName);
  if (type === 'local') return 'local';
  if (type === 'mobileme' || name === 'icloud') return 'icloud';
  if (type === 'birthdays') return 'birthdays';
  if (type === 'subscribed') return 'subscribed';
  if (type === 'exchange') return 'exchange';
  if (type === 'caldav') return 'caldav';
  return 'unknown';
}

/** Emails named by an Apple calendar's source (source title, account label). */
function appleAccountEmails(cal: ExternalCalendar): string[] {
  const out = new Set<string>();
  for (const s of [cal.sourceName, cal.accountLabel]) {
    const e = canonicalEmail(s);
    if (e) out.add(e);
  }
  return [...out];
}

function googleAccountEmail(cal: ExternalCalendar): string | null {
  return canonicalEmail(cal.accountId) ?? canonicalEmail(cal.accountLabel);
}

export function calendarDetails(cal: ExternalCalendar): CalendarDetails {
  return {
    provider: cal.provider,
    providerLabel: cal.provider === 'google' ? t.google : t.apple,
    accountId: cal.accountId,
    accountLabel: cal.accountLabel,
    calendarId: cal.calendarId,
    calendarTitle: cal.title,
    isPrimary: cal.isPrimary,
    sourceType: cal.provider === 'apple' ? cal.sourceType : null,
    sourceName: cal.provider === 'apple' ? cal.sourceName : null,
  };
}

/** Stable key of a Google × Apple destination pair (used to remember a user's resolution). */
export function pairKey(google: CalendarRef, apple: CalendarRef): string {
  return `${refKey(google)}|${refKey(apple)}`;
}

// ─── classification ──────────────────────────────────────────────────────────

function result(verdict: EquivalenceVerdict, reason: EquivalenceReason, google: ExternalCalendar, apple: ExternalCalendar): EquivalenceResult {
  return {
    verdict,
    reason,
    message: verdict === 'equivalent' ? EQUIVALENCE_STRINGS.equivalent : verdict === 'unknown' ? EQUIVALENCE_STRINGS.unknown : EQUIVALENCE_STRINGS.distinct,
    detail: EQUIVALENCE_STRINGS.reasons[reason],
    details: { google: calendarDetails(google), apple: calendarDetails(apple) },
  };
}

/** Google calendars of the same account whose title (or primary email title) matches `title`. */
function sameAccountTitleMatches(email: string, title: string, ctx: EquivalenceContext | undefined): ExternalCalendar[] | null {
  if (!ctx?.googleCalendars) return null;
  const n = normalizeCalendarTitle(title);
  const titleEmail = canonicalEmail(title);
  return ctx.googleCalendars.filter((g) => {
    if (g.provider !== 'google' || googleAccountEmail(g) !== email) return false;
    if (n && normalizeCalendarTitle(g.title) === n) return true;
    return titleEmail != null && g.isPrimary && canonicalEmail(g.calendarId) === titleEmail;
  });
}

/**
 * Classify a Google calendar against an iPhone calendar. The arguments may be
 * given in either order; both must not be from the same provider (use
 * `sameUnderlyingCalendar` for arbitrary pairs).
 */
export function classifyEquivalence(a: ExternalCalendar, b: ExternalCalendar, ctx?: EquivalenceContext): EquivalenceResult {
  if (a.provider === b.provider) throw new Error('classifyEquivalence: expects one Google and one Apple calendar');
  const google = a.provider === 'google' ? a : b;
  const apple = a.provider === 'google' ? b : a;

  const kind = appleSourceKind(apple);
  const gEmail = googleAccountEmail(google);
  const aEmails = appleAccountEmails(apple);
  const sameAccount = gEmail != null && aEmails.includes(gEmail);

  // Storage that is clearly not this Google account.
  switch (kind) {
    case 'local':
      return result('distinct', 'apple_local', google, apple);
    case 'icloud':
      return result('distinct', 'apple_icloud', google, apple);
    case 'birthdays':
      return result('distinct', 'apple_birthdays', google, apple);
    case 'subscribed':
      return result('distinct', 'apple_subscribed', google, apple);
    case 'exchange':
      // A Google Workspace account can be added to iOS through Exchange (Google Sync).
      return sameAccount ? result('unknown', 'exchange_same_email', google, apple) : result('distinct', 'apple_exchange', google, apple);
    default:
      break;
  }

  if (!gEmail) return result('unknown', 'missing_details', google, apple);
  if (aEmails.length > 0 && !sameAccount) return result('distinct', 'apple_other_account', google, apple);

  const gTitle = normalizeCalendarTitle(google.title);
  const aTitle = normalizeCalendarTitle(apple.title);
  const titlesMatch = gTitle !== '' && gTitle === aTitle;
  const appleTitleEmail = canonicalEmail(apple.title);
  const googleIsPrimaryEmail = google.isPrimary && canonicalEmail(google.calendarId) === gEmail;
  const primaryRule = googleIsPrimaryEmail && appleTitleEmail === gEmail;

  if (sameAccount) {
    if (titlesMatch) {
      const matches = sameAccountTitleMatches(gEmail, apple.title, ctx);
      if (matches && matches.filter((g) => g.calendarId !== google.calendarId).length > 0) {
        return result('unknown', 'same_account_title_ambiguous', google, apple);
      }
      return result('equivalent', 'same_account_same_title', google, apple);
    }
    if (primaryRule) return result('equivalent', 'primary_email_title', google, apple);
    // The iPhone calendar is the account's primary (titled with the email), the chosen Google calendar is another one.
    if (appleTitleEmail === gEmail && !google.isPrimary) return result('distinct', 'other_calendar_same_account', google, apple);
    const matches = sameAccountTitleMatches(gEmail, apple.title, ctx);
    if (matches && matches.length === 1 && matches[0].calendarId !== google.calendarId) {
      return result('distinct', 'other_calendar_same_account', google, apple);
    }
    if (matches && matches.length > 1) return result('unknown', 'same_account_title_ambiguous', google, apple);
    return result('unknown', 'same_account_title_mismatch', google, apple);
  }

  // The iOS source does not name an email ("Gmail", "Google", a custom description…).
  if (primaryRule) return result('equivalent', 'primary_email_title', google, apple);
  return result('unknown', 'apple_source_unidentified', google, apple);
}

/**
 * Verdict for any two destination calendars: within one provider, equal
 * calendar ids are the same calendar (Google ids are global and EventKit ids
 * are unique on the device, so the account is ignored); across providers,
 * `classifyEquivalence`.
 */
export function sameUnderlyingCalendar(a: ExternalCalendar, b: ExternalCalendar, ctx?: EquivalenceContext): EquivalenceVerdict {
  if (a.provider === b.provider) return a.calendarId === b.calendarId ? 'equivalent' : 'distinct';
  return classifyEquivalence(a, b, ctx).verdict;
}

/**
 * The "Both" rule. Equivalent destinations are always blocked (the user picks
 * one route). Unknown ones are blocked until the user confirms them as
 * distinct (`resolution = 'resolved_distinct'` for THIS pair).
 */
export function gateBothDestinations(google: ExternalCalendar, apple: ExternalCalendar, resolution: BothResolution, ctx?: EquivalenceContext): BothGate {
  const equivalence = classifyEquivalence(google, apple, ctx);
  if (equivalence.verdict === 'equivalent') return { allowed: false, code: 'equivalent', message: EQUIVALENCE_STRINGS.equivalent, equivalence };
  if (equivalence.verdict === 'unknown') {
    if (resolution === 'resolved_distinct') return { allowed: true, equivalence, resolvedByUser: true, message: EQUIVALENCE_STRINGS.resolvedDistinct };
    return { allowed: false, code: 'unresolved', message: EQUIVALENCE_STRINGS.unknown, equivalence };
  }
  return { allowed: true, equivalence, resolvedByUser: false, message: EQUIVALENCE_STRINGS.distinct };
}
