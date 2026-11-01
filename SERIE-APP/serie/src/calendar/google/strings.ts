/**
 * Google Calendar — user-facing Italian strings (short, plain, no apologies).
 * Reuses the shared i18n keys where they already exist.
 */
import { t } from '@/i18n/it';

export const GOOGLE_STRINGS = {
  notConfigured: t.notConfigured,
  invalidClientId: 'ID client OAuth di Google non valido in questa build.',
  unavailablePlatform: t.unavailablePlatform,
  expoGo: 'Google Calendar richiede una development build: in Expo Go non è disponibile.',
  disconnected: 'Collega il tuo account Google per importare ed esportare.',
  sessionExpired: 'Sessione Google scaduta. Collega di nuovo.',
  revoked: 'Accesso a Google revocato o scaduto. Collega di nuovo.',
  cancelled: 'Autorizzazione annullata.',
  denied: 'Accesso a Google Calendar non concesso.',
  writeOnly: t.writeOnly,
  primaryCalendar: 'Calendario principale',
  scopesMissing: 'Non hai concesso l’accesso ai calendari. Collega di nuovo e seleziona i permessi.',
  oauthError: (code: string) => `Google ha rifiutato l’autorizzazione (${code}).`,
  noAccount: 'Non riesco a leggere l’account Google. Riprova.',
  authorizeFailed: 'Non riesco ad aprire l’accesso a Google in questa build.',
  needsRead: 'Serve il permesso di lettura dei calendari Google.',
  needsWrite: 'Serve il permesso di scrittura sugli eventi Google.',

  // ProviderError messages
  offline: 'Sei offline: riprova quando torna la rete.',
  unauthorized: 'Collegamento a Google scaduto: collega di nuovo.',
  forbidden: 'Google non consente questa operazione su questo calendario.',
  insufficientScope: 'Permesso Google mancante: collega di nuovo concedendo l’accesso richiesto.',
  apiDisabled: 'L’API Google Calendar non è abilitata per questo progetto.',
  notFound: 'Evento o calendario non trovato su Google.',
  rateLimited: 'Troppe richieste a Google: riprovo più tardi.',
  unavailable: 'Google Calendar non risponde: riprovo più tardi.',
  uncertain: 'Non so se l’evento è stato creato: verifico prima di riprovare.',
  invalid: 'Richiesta non valida per Google Calendar.',
  conflict: 'L’evento è cambiato nel frattempo su Google.',
  unknown: 'Errore imprevisto di Google Calendar.',
  invalidColor: 'Etichetta colore non valida per Google Calendar.',
  invalidTiming: 'Orario dell’evento non valido.',
  seriesUpdate: 'È una serie ricorrente: scegli la singola occorrenza da aggiornare.',
  linkedDeleted: 'L’evento collegato è stato eliminato su Google.',
  opIdUnreadable: 'Su Google c’è già un evento di questa esportazione, ma i suoi dati Serie non sono leggibili. Controllalo prima di riprovare.',
  freeBusyOnly: 'Di questo calendario vedi solo libero/occupato: gli eventi non sono leggibili.',
} as const;

/** Italian names of Google Calendar's event colours (colorId 1…11), as shown in the Italian Google UI. */
export const GOOGLE_EVENT_COLOR_NAMES_IT: Readonly<Record<string, string>> = Object.freeze({
  '1': 'Lavanda',
  '2': 'Salvia',
  '3': 'Uva',
  '4': 'Fenicottero',
  '5': 'Banana',
  '6': 'Mandarino',
  '7': 'Pavone',
  '8': 'Grafite',
  '9': 'Mirtillo',
  '10': 'Basilico',
  '11': 'Pomodoro',
});

export const colorFallbackName = (id: string) => `Colore ${id}`;
