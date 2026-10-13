# Serie — scelte da provare su iPhone

Le richieste sono implementate in un'unica direzione. Queste sono le scelte adottate dove erano possibili più soluzioni: potrai rivederle dopo aver usato l'app, senza che servano risposte prima della consegna.

| Aspetto | Scelta adottata | Motivo |
| --- | --- | --- |
| Tema | Crema uniforme come impostazione iniziale; scuro selezionabile e ricordato. | Richiama una carta chiara e pulita e lascia risaltare la palette, senza aggiungere texture. |
| Movimento | «Segui il sistema» iniziale; completo e ridotto restano disponibili. | Seguire il sistema rispetta «Riduci movimento» dell'iPhone; completo applica gli effetti dell'app. Le onde restano nelle celle e nella capsula, quindi entrambe le modalità usano la stessa griglia compatta. |
| Chiusura dei pannelli | Gesto verso il basso insieme a un comando visibile di chiusura o ritorno. | Il gesto è comodo, mentre il comando offre un'alternativa riconoscibile e accessibile. Le intestazioni ripetute sono eliminate e la navigazione torna alla schermata di provenienza. |
| Navigazione principale | Attività sempre nella barra in basso; Storia accessibile dalla Home; Progressi dentro Storia. | Mantiene vicino il gesto più frequente, registrare, e lascia il calendario leggibile. Una seconda barra di navigazione in basso rimane una possibile evoluzione se Storia e Progressi diventeranno altrettanto frequenti. |
| Calendario e colori | Mesi in verticale e colori di tutte le attività visibili inizialmente; l'attività scelta risalta. Una preferenza permette di mostrare solo quella attiva. | Si può registrare con il colore scelto mantenendo una visione d'insieme. La barra delle attività scorre solo quando il pulsante scelto è tagliato o fuori vista. |
| Giorni con più attività | Una porzione uguale per ciascuna attività distinta: diagonale per due, bande per tre, quadranti per quattro. Oltre quattro, quattro colori stabili e indicazione «+N». | La geometria esprime quali attività ci sono; il numero di sessioni e il tempo restano dati espliciti, senza suggerire durate non registrate. Il dettaglio conserva tutte le attività. |
| Gesto sul giorno | Tocco per selezionare una nuova sessione; pressione prolungata o comando «Sessioni» per il dettaglio sul posto. | Permette di registrare anche più sessioni nello stesso giorno senza cambiare il significato del tocco. Modificare una sessione riporta al suo giorno e poi al calendario di origine. |
| Dettagli della selezione | «Applica» inserisce i dettagli nella bozza dell'attività; il salvataggio delle sessioni resta separato. | Date e dettagli applicati sopravvivono al cambio attività e alla riapertura. Chiudere il pannello Dettagli scarta solo le modifiche non applicate; gli editor di attività, periodi e sessioni già salvate chiedono conferma prima di scartare modifiche. |
| Storia e Progressi | Storia consulta le sessioni reali; Progressi ne riassume frequenza, distribuzione e durate disponibili. | Storia mensile mostra solo mesi con sessioni, aperti inizialmente. Un anno vuoto mostra anno e zero sessioni; un anno popolato mantiene dodici piccoli mosaici per dare un'immagine completa dell'anno. |
| Periodi con un nome | Intervallo inclusivo, nome, nota facoltativa e tutte o alcune attività; sovrapposizioni consentite. | Un periodo racconta una parte della propria storia e conta le sessioni comprese. Cancellarlo elimina soltanto la sua descrizione, senza cancellare allenamenti o altre sessioni. |

La versione consegnata, il commit esatto dell'IPA e i risultati delle verifiche sono registrati nel [documento di passaggio a Claude/Codex](CODEX_HANDOFF.md). Le preferenze già presenti permettono di provare tema, movimento e visualizzazione delle attività direttamente sull'iPhone.

## Aggiornamento 1.2 dopo la prova su iPhone

- Toccare di nuovo l'attività attiva la disattiva. Nessuna attività selezionata significa visualizzare tutte le attività a colori pieni, anche con «Solo attiva» impostato. Il tocco su un giorno apre il dettaglio; per registrare si sceglie nuovamente un'attività. Le bozze vengono conservate e anche la modalità senza selezione viene ricordata alla riapertura.
- Le sessioni ripetute mostrano `×2`, `×3` ecc. sulla porzione del proprio colore nelle griglie mensili della Home e di Storia. Le porzioni restano uguali tra attività; i mosaici annuali più piccoli conservano i conteggi nei dettagli, evitando cifre illeggibili.
- Nel dettaglio del giorno, scorrere una sessione verso sinistra rivela «Elimina». Un secondo comando conferma la cancellazione. Resta disponibile anche un pulsante accessibile senza gesto.
- La scelta del colore offre 24 campioni e un selettore continuo, con codice esadecimale facoltativo. I colori già scelti restano invariati. I testi sopra colori personalizzati mantengono il contrasto.
- Il fuso orario si sceglie da un elenco ricercabile; il fuso del dispositivo è una scelta rapida. Le durate si inseriscono con ore e minuti separati, preservando la precisione delle sessioni esistenti.
- La Home mostra l'anno in grande. Il menu omette il proprio titolo visibile e i collegamenti duplicati a Storia e Progressi; le etichette per le tecnologie assistive restano disponibili.
- Le grane identificano visivamente le attività nei simboli e nelle anteprime. Non modificano conteggi, statistiche o comportamento delle sessioni e non sono texture dei giorni del calendario verticale.
- Per contenere il consumo di GitHub Actions, i controlli di questa versione si svolgono localmente e si richiede una sola compilazione IPA, senza avviare il simulatore remoto. Se la quota impedisce l'avvio, si conserva il codice verificato e si registra il blocco senza abilitare spese o cambiare la visibilità del repository.
