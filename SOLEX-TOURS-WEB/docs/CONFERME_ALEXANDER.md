# Da confermare con Alexander prima di pubblicare

Il sito è una **proposta**: tutto ciò che è scritto viene dalle parole di Alexander (vocali del 31 ott 2026, sintesi del cliente), dal sito attuale, dal suo profilo Google e dalle recensioni verificate. Dove le fonti non concordano ho scelto un valore predefinito, facile da cambiare (quasi tutto è in un unico `CONFIG` in `src/assets/js/site.js` e nel testo di `src/index.html`).

## Scelte predefinite usate nel sito (da confermare)

| Tema | Nel sito | Stato |
|---|---|---|
| Ritrovo tour 2 giorni | **8:00** a Café Condesa o Café La Parada, **dalle 6:30 su richiesta** | ✅ Confermato (round 2) |
| Pasti | **4**: colazione, pranzo e cena il giorno 1, colazione il giorno 2 · cioccolata calda la sera, caffè o tè al mattino | ✅ Confermato (round 2). Da chiarire solo dove si fa la colazione del giorno 1 |
| Pagamento | **Solo contanti** | ✅ Confermato (round 2) |
| Panajachel / Lago Atitlán | Add-on opzionale su richiesta, fa risparmiare **fino a 90 minuti** | ✅ Confermato (round 2). Da chiarire chi fa il trasporto e quanto costa |
| Escursione Fuego | Opzionale, circa 4 ore (2 h andata, 30 min lassù, 2 h ritorno), +Q300, si decide e si paga al campo | ✅ Come da tue indicazioni. Vedi nota sotto |
| Cabina privata | Su richiesta e se il campo è tranquillo: per una persona, una coppia o un piccolo gruppo | ✅ Come da tue indicazioni |
| Temperatura notturna al campo | Di solito tra −2 °C e +5 °C | ✅ Confermato (round 2) |
| Piattaforma privata con panche e sedie davanti al Fuego | Presente nel testo del pomeriggio | ✅ Confermato (round 2) |
| Prezzo | **Q750 ≈ US$100** (express Q675 ≈ US$90) | Da confermare se accetta dollari e a quanto |
| Guanti e berretto | **Non** elencati tra gli inclusi | Da confermare |
| Altri tour (mezzanotte, tramonto, express) | Mostrati come "Our other tours", con orari e prezzi del sito attuale | Da confermare che siano ancora attivi |
| Portatore | Q250 salita + Q250 discesa, fino a 13 kg (su richiesta, non incluso) | Da confermare |
| Noleggio | Giacche, zaini, frontali, bastoncini, scarpe: su richiesta, non inclusi, prezzi "su WhatsApp" | Da confermare i prezzi |
| Famiglia / 100% locale / guide con anni nelle grandi agenzie / 20+ anni / fondata 2019 | Presenti nella sezione "storia" | Da far approvare il testo ad Alexander |
| Recensioni | 6 citazioni testuali da Google (5,0 · 25 recensioni, verificato 1 nov 2026) | Da far approvare ad Alexander |
| Versione spagnola | Tutto il sito tradotto, con il "tú" come sul sito attuale | Da far rileggere ad Alexander |
| Lago Atitlán dal campo | "la catena di vulcani verso il lago Atitlán, con cielo limpido" | Dal campo si vede la catena; la superficie del lago potrebbe vedersi poco |

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

In entrambi i casi spariscono tutte le menzioni (in inglese e in spagnolo) e il resto del sito non cambia.

## Messaggio per Alexander (spagnolo, pronto da inviare)

```
Hola Alexander 👋 Ya tenemos lista la propuesta del nuevo sitio web, en inglés y en español. Antes de publicarlo necesitamos confirmar estos datos:

1. ¿La recogida de las 8:00 AM (o 6:30 AM a solicitud) es a la misma hora en Café Condesa y en Café La Parada? ¿Dónde se sirve el desayuno del primer día?
2. ¿A qué hora suelen empezar a caminar, llegar al campamento, salir a la cumbre y regresar a Antigua?
3. ¿Los guantes y gorros están incluidos?
4. ¿Siguen los otros tours y precios? Media Noche Q750 (10:30 PM), Atardecer Q750 (10:30 AM), Un Día Q675 (5:00 AM).
5. Pago en efectivo: ¿en quetzales y también en dólares? ¿Piden anticipo? ¿Qué pasa si el cliente cancela, cambia la fecha o hay mal tiempo?
6. ¿Qué número recibe las reservas del sitio (4834 7003 o 4946 8883)? ¿Quién contesta los mensajes en inglés?
7. Precios de alquiler: chaqueta, mochila, linterna, bastones, zapatos. Porteador: ¿sigue Q250 subida y Q250 bajada (13 kg)?
8. Campamento: ¿hay baño? ¿Se puede comprar agua o comida?
9. Excursión al Fuego: ¿la están haciendo actualmente? ¿A qué hora sale del campamento? Si alguien empieza y se regresa, ¿paga igual los Q300?
10. Panajachel: ¿quién da el transporte después del tour y cuánto cuesta?
11. ¿Ofrecen tour privado o cabaña privada con precio? ¿Edad mínima? ¿Personas que viajan solas pueden unirse?
12. En el sitio decimos: "pequeña empresa familiar, 100% local y comunitaria de La Soledad; guías locales con experiencia, muchos trabajaron años en las agencias grandes; fundada en 2019 por Alexander, con más de 20 años de experiencia como guía". ¿Está bien así?
13. Fotos: ¿las fotos del Fuego de noche y del atardecer se tomaron desde su campamento? ¿Tenemos permiso de los turistas que salen en las fotos? Si puede, mándenos las fotos originales como "Documento" (mejor calidad), una foto suya y de los guías, y fotos de la comida, del baño y del comedor.
14. ¿Podemos mostrar en el sitio frases de sus reseñas de Google?
15. ¿Puede leer la versión en español del sitio y decirnos si algo no suena bien?

¡Muchas gracias!
```

## Al momento della pubblicazione

- **Indicizzazione:** in `src/index.html` togli `<meta name="robots" content="noindex, nofollow">` e in `robots.txt` togli `Disallow: /`. Poi rigenera con `npm run build`.
- **Profilo Google Business:** il campo "sito web" oggi punta a Facebook. Va cambiato con `https://solex-tours.com`.
- **Dominio:** `solextours.com` (senza trattino) non è loro, è un dominio parcheggiato di terzi.
