# Da confermare con Alexander prima di pubblicare

Il sito è una **proposta**: tutto ciò che è scritto viene dalle parole di Alexander (vocali del 31 ott 2026, sintesi del cliente), dal sito attuale, dal suo profilo Google e dalle recensioni verificate. Dove le fonti non concordano ho scelto un valore predefinito, facile da cambiare (quasi tutto è in un unico `CONFIG` in `src/assets/js/site.js` e nel testo di `src/index.html`).

## Scelte predefinite usate nel sito (da confermare)

| Tema | Nel sito | Perché / alternativa |
|---|---|---|
| Ritrovo tour 2 giorni | **~8:00** a Café Condesa o Café La Parada | Vocale più recente: "a las ocho". Il sito attuale dice 6:30 |
| Pasti | **3** (pranzo, cena, colazione) + cioccolata calda e caffè | Alexander dice 3; il sito attuale ne indica 4 |
| Prezzo | **Q750 ≈ US$100** (express Q675 ≈ US$90) | Il sito attuale usa $100; al cambio Banguat del 31/10 Q750 ≈ US$98 |
| Guanti e berretto | **Non** elencati tra gli inclusi | Solo sul sito attuale, Alexander non li cita |
| Altri tour (mezzanotte, tramonto, express) | Mostrati come secondari, con orari e prezzi del sito attuale | Alexander non li cita nei vocali |
| Portatore | Q250 salita + Q250 discesa, fino a 13 kg | Solo sito attuale |
| Noleggio | Giacche, zaini, frontali, bastoncini, scarpe: prezzi "su WhatsApp" | Nessun prezzo pubblicato |
| Escursione Fuego | Come la propone Alexander: opzionale, ~4 h, +Q300, si decide e si paga al campo | Direttiva del cliente; nessuna frase su leggi/divieti. Vedi nota sotto |
| Famiglia / 100% locale / guide con anni nelle grandi agenzie / 20+ anni / fondata 2019 | Presenti nella sezione "storia" | Direttive del cliente + descrizione scritta da Alexander su Google |
| Recensioni | 6 citazioni testuali da Google (5,0 · 25 recensioni, verificato 1 nov 2026) | Le spagnole sono tradotte e marcate come tali |
| Lago Atitlán | "la catena di vulcani verso il lago Atitlán, con cielo limpido" | Dal campo si vede la catena; la superficie del lago potrebbe vedersi poco |

## Nota sull'escursione al Fuego (solo per te, non per il sito)

Come richiesto, il sito la presenta esattamente come la descrive Alexander e **non** contiene nessuna frase su leggi o divieti. Per tua informazione, la ricerca ha trovato fonti ufficiali recenti:

- **Municipio di Acatenango:** "prohibición total del ascenso al Volcán de Fuego" per agenzie, guide e visitatori (1 apr 2026, confermata il 7 ago).
- **CONRED:** "No está autorizado el ascenso al Volcán de Fuego" (9 ago 2026).
- **INSIVUMEH:** il bollettino del 31 ott 2026 indica le zone di La Meseta ed El Camellón tra quelle in cui è vietato avvicinarsi e accampare.
- **INGUAT:** il 10 ott 2026 ha avvertito che vendere queste escursioni può comportare responsabilità amministrative e penali.

I link sono in `docs/research/03_regulations_facts.md` (sezione Fuego). Alcuni concorrenti continuano a proporla.

È una decisione vostra e di Alexander. Il blocco è facile da togliere:
- `CONFIG.features.fuegoAddon = false`, oppure
- `node tools/build.mjs --no-fuego-hike`.

In entrambi i casi spariscono tutte e tre le menzioni e il resto del sito non cambia.

## Messaggio per Alexander (spagnolo, pronto da inviare)

```
Hola Alexander 👋 Ya tenemos lista la propuesta del nuevo sitio web en inglés. Antes de publicarlo necesitamos confirmar estos datos:

1. Tour 2 días / 1 noche: ¿la salida en Antigua es a las 8:00 AM o a las 6:30 AM? ¿La misma hora en Café Condesa y en Café La Parada?
2. ¿A qué hora suelen empezar a caminar, llegar al campamento, salir a la cumbre y regresar a Antigua?
3. Comidas: ¿son 3 (almuerzo, cena, desayuno) o 4? ¿Los guantes y gorros están incluidos?
4. ¿Siguen los otros tours y precios? Media Noche Q750 (10:30 PM), Atardecer Q750 (10:30 AM), Un Día Q675 (5:00 AM).
5. Pago y reservas: ¿piden anticipo? ¿Cómo se paga (efectivo Q o US$, transferencia, tarjeta)? ¿Qué pasa si el cliente cancela, cambia la fecha o hay mal tiempo?
6. ¿Qué número recibe las reservas del sitio (4834 7003 o 4946 8883)? ¿Quién contesta los mensajes en inglés?
7. Precios de alquiler: chaqueta, mochila, linterna, bastones, zapatos. Porteador: ¿sigue Q250 subida y Q250 bajada (13 kg)?
8. Campamento: ¿hay baño? ¿Se puede comprar agua o comida?
9. Excursión al Fuego: ¿la están haciendo actualmente? ¿A qué hora sale del campamento? Si alguien empieza y se regresa, ¿paga igual los Q300?
10. Panajachel: ¿quién da el transporte después del tour y cuánto cuesta?
11. ¿Ofrecen tour privado o cabaña privada con precio? ¿Edad mínima? ¿Personas que viajan solas pueden unirse?
12. En el sitio decimos: "pequeña empresa familiar, 100% local y comunitaria de La Soledad; guías locales con experiencia, muchos trabajaron años en las agencias grandes; fundada en 2019 por Alexander, con más de 20 años de experiencia como guía". ¿Está bien así?
13. Fotos: ¿las fotos del Fuego de noche y del atardecer se tomaron desde su campamento? ¿Tenemos permiso de los turistas que salen en las fotos? Si puede, mándenos las fotos originales como "Documento" (mejor calidad), una foto suya y de los guías, y fotos de la comida, del baño y del comedor.
14. ¿Podemos mostrar en el sitio frases de sus reseñas de Google?

¡Muchas gracias!
```

## Al momento della pubblicazione

- **Indicizzazione:** in `src/index.html` togli `<meta name="robots" content="noindex, nofollow">` e in `robots.txt` togli `Disallow: /`. Poi rigenera con `npm run build`.
- **Profilo Google Business:** il campo "sito web" oggi punta a Facebook. Va cambiato con `https://solex-tours.com`.
- **Dominio:** `solextours.com` (senza trattino) non è loro, è un dominio parcheggiato di terzi.
