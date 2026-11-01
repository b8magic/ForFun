/**
 * Maps links — user-facing Italian strings (short, plain, no apologies).
 *
 * These are the `Place.resolutionNote` reasons. The session sheet already
 * shows a status line per resolution (t.mapResolved / t.mapUnresolved /
 * t.mapUnsupported …), so a note only adds the specific "why", never repeats
 * that the link is kept.
 */
export const MAPS_STRINGS = {
  /** Coordinates taken from the map centre (@lat,lng / ll=), not from a pin. */
  viewportOnly: 'Posizione letta dal centro della mappa nel link: controlla il punto.',
  /** A place named by text only; no geocoding service is used. */
  nameOnly: 'Il link indica il luogo solo per nome, senza coordinate. Puoi posizionare il punto a mano.',
  noCoordinates: 'Il link non contiene coordinate. Puoi posizionare il punto a mano.',
  directions: 'È un link di indicazioni stradali, non di un singolo luogo.',
  /** A Google Maps page that is not a place (a profile, a My Maps map…). */
  notAPlace: 'Il link di Google Maps non indica un singolo luogo.',
  notALink: 'Non è un link valido.',
  outOfRange: 'Le coordinate nel link non sono valide.',
  shortNotMaps: 'Il link breve porta a una pagina che non è di Google Maps.',
  offline: 'Rete non raggiungibile.',
  blockedByBrowser: 'Questo browser non consente di leggere i link brevi.',
  timeout: 'Google Maps non ha risposto in tempo.',
  notFound: 'Google non riconosce questo link breve. Controlla di averlo copiato per intero.',
  httpError: 'Google Maps non risponde in questo momento.',
  tooManyRedirects: 'Il link breve rimanda troppe volte.',
  interstitial: 'Google ha mostrato una pagina intermedia senza il luogo.',
  noNetworkApi: 'Lettura dei link brevi non disponibile qui.',
  unexpected: 'Lettura del link non riuscita.',
} as const;
