/**
 * User-facing Italian strings of the Apple (EventKit) calendar provider.
 * Shared wording is reused from `@/i18n/it`; the rest lives here as named
 * constants (short, plain, no apologies).
 */
import { t } from '@/i18n/it';

export const APPLE_PROVIDER_LABEL = t.apple;

// ─── connection details ──────────────────────────────────────────────────────
export const APPLE_DETAIL_UNAVAILABLE = t.unavailablePlatform;
export const APPLE_DETAIL_DENIED = t.permissionDenied;
export const APPLE_DETAIL_WRITE_ONLY = t.writeOnly;
export const APPLE_DETAIL_NOT_ASKED = 'Serie chiede l’accesso ai calendari solo quando tocchi Collega.';
export const APPLE_DETAIL_NOT_CONFIGURED =
  'Questa build non dichiara il permesso calendari (Info.plist): l’accesso non può essere richiesto.';
export const APPLE_DETAIL_EXPO_GO = 'In Expo Go i calendari di iPhone non sono disponibili: serve una development build.';
export const APPLE_DETAIL_DISCONNECTED =
  'Scollegato da Serie. Per revocare del tutto l’accesso usa Impostazioni di iOS.';

// ─── account labels ──────────────────────────────────────────────────────────
export const APPLE_ACCOUNT_LOCAL = 'Sul mio iPhone';
export const APPLE_ACCOUNT_FALLBACK: Record<string, string> = {
  local: APPLE_ACCOUNT_LOCAL,
  caldav: 'CalDAV',
  exchange: 'Exchange',
  mobileme: 'iCloud',
  subscribed: 'Calendari iscritti',
  birthdays: 'Compleanni',
};
export const APPLE_ACCOUNT_UNKNOWN = 'Account sconosciuto';

// ─── provider errors (may surface as a job's last error) ────────────────────
export const APPLE_ERR_UNAVAILABLE = t.unavailablePlatform;
export const APPLE_ERR_DISCONNECTED = 'Calendari di iPhone scollegati da Serie.';
export const APPLE_ERR_NO_ACCESS = 'Accesso ai calendari non concesso.';
export const APPLE_ERR_NEEDS_READ = t.writeOnly;
export const APPLE_ERR_NOT_CONFIGURED = APPLE_DETAIL_NOT_CONFIGURED;
export const APPLE_ERR_CALENDAR_NOT_FOUND = 'Calendario non trovato sul dispositivo.';
export const APPLE_ERR_EVENT_NOT_FOUND = 'Evento non trovato nel calendario.';
export const APPLE_ERR_READ_ONLY_CALENDAR = 'Questo calendario è di sola lettura.';
export const APPLE_ERR_INVALID_EVENT = 'Dati dell’evento non validi.';
export const APPLE_ERR_OCCURRENCE_REQUIRED = 'Evento ricorrente: serve l’occorrenza da aggiornare.';
export const APPLE_ERR_WRONG_CALENDAR = 'L’evento è stato spostato in un altro calendario.';
export const APPLE_ERR_UNCERTAIN = 'Esito incerto: verifico nel calendario prima di ritentare.';
export const APPLE_ERR_UNKNOWN = 'Il calendario ha restituito un errore.';
export const APPLE_ERR_ABORTED = 'Lettura annullata.';
export const APPLE_ERR_WRITE_ONLY_CALENDAR =
  'Con l’accesso solo in scrittura iOS lascia scrivere solo nel calendario predefinito.';
