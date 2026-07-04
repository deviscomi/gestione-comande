# Documento Requisiti Funzionali — Sistema Gestione Comande

## 1. Contesto operativo

### Zone e tavoli
| Zona | Tavoli | Note |
|---|---|---|
| Sotto | 10 | Fissi |
| Sopra | 10 | Fissi |
| Saletta Sopra | 3 | Fissi |
| Fuori | 10 | Stagionali — abilitabili/disabilitabili |

**Espansione bis/tris:** ogni tavolo può avere fino a 3 istanze: `Tav 2 Fuori` → `Tav 2 Bis Fuori` → `Tav 2 Tris Fuori`

**Zona Fuori:** abilitata/disabilitata definitivamente dall'admin. Il cameriere può mostrarla/nasconderla durante il servizio.

### Personale
- 1 tablet operativo, 1 cameriere addetto alle comande
- Architettura multi-cameriere ready (ogni tavolo registra il cameriere)
- Ruoli: `admin` (tutto) e `waiter` (solo tablet)

### Menu — categorie
`Antipasti` · `Primi` · `Secondi` · `Contorni` · `Pizze` · `Bevande` · `Dessert` · `Amari`

### Varianti per categoria
| Categoria | Varianti |
|---|---|
| Antipasti / Primi / Contorni | Porzione: poco / standard / abbondante + note libere |
| Primi | + senza glutine, allergeni |
| Secondi | Cottura: al sangue / media (default) / ben cotta + note |
| Pizze | Base, impasto, mozzarella, aggiunte/rimozioni ingredienti con (-/+), taglio |
| Bevande | Ghiaccio, zucchero (più/meno/no) |

**Campo note libero** su ogni articolo di ogni categoria.

### Stampante
- **Modello:** Bisofice POS-8370
- **Protocollo:** ESC/POS via TCP/IP porta 9100
- **Configurazione attuale:** 1 stampante per tutte le copie (smistamento manuale)
- **Architettura:** N stampanti configurabili per reparto da backoffice

---

## 2. Ciclo di vita tavolo

```
LIBERO → OCCUPATO (manuale) → IN CORSO (automatico su invio) → CHIUSO (manuale + conferma) → LIBERO
```

| Stato | Sigla | Chi lo imposta |
|---|---|---|
| Libero | L | Sistema (default/chiusura) |
| Occupato | O | Cameriere manualmente |
| In Corso | I | Sistema automaticamente al primo invio |
| Chiuso | — | Cameriere con conferma esplicita |

---

## 3. Logica stampa — matrice invii

### Primo invio: sempre 3 stampe
| Stampa | Contenuto |
|---|---|
| Cassiere | Riepilogo completo con prezzi e totale |
| Cucina | Riepilogo per portata + elenco completo pizze (no prezzi) |
| Pizzeria | Solo pizze + segnale sincronizzazione |

### Invii successivi
| Contenuto aggiunta | Cassiere | Cucina | Pizzeria |
|---|---|---|---|
| Solo bevande | Ristampa integrale | NO | NO |
| Pizze (con o senza altro) | Ristampa integrale | Ristampa integrale | Ristampa integrale |
| Cucina (no pizze) | Ristampa integrale | Ristampa integrale | Solo se pizze in invii precedenti + `CUCINA` |
| Solo Dessert/Amari | Ristampa integrale | Solo aggiunta | NO |

### Segnali pizzeria
- `⏳ ATTESA` — ci sono antipasti nell'ordine
- `CUCINA` — le pizze devono sincronizzarsi con la cucina

### Layout stampe
**Cassiere:** intestazione (tavolo, coperti, ora, cameriere) + articoli con prezzi + totale
**Cucina:** stessa intestazione + portate con divisori `--- ANTIPASTI ---` + no prezzi
**Pizzeria:** tavolo/coperti/ora + segnali in cima + pizze con formato `[CERE] [R] [NO LATT.] NomePizza (+ag, -rim)`

**Regole comuni:** numero progressivo `Comanda #0042`, `*** RISTAMPA ***` su ristampe, taglio carta automatico, no logo ristorante.

---

## 4. Varianti pizza

| Tipo | Opzioni |
|---|---|
| Impasto | Normale (default, non stampato) · `CERE` · `DOPP` |
| Base | `M` · `Rose'` · `R` · `B` · `S` |
| Mozzarella | Normale (default, non stampato) · `NO LATT.` |

**Formato stampa pizza:** `[CERE] [R] [NO LATT.] Nome (+aggiunta, -rimozione, poco X, abbondante Y) SPICCHI`

**Calcolo prezzo:** `base_price + Σ aggiunte - Σ rimozioni default + Σ varianti`

**Taglio:** per pizza singola (spicchi / meta') + selezione rapida "tutte a spicchi" a fine ordine.

**Quantità:** se stesso piatto senza varianti → `x2 Margherita`. Con varianti → riga separata per ogni pizza.

---

## 5. Interfaccia cameriere (tablet)

### Lista tavoli
- Divisa per zona con layout a 3 colonne
- Card tavolo: numero, sigla status, coperti
- `(+)` per creare Bis/Tris (senza conferma)
- `(-)` per eliminare Bis/Tris (con conferma, solo se `L`)
- Zona Fuori: toggle abilitazione

### Pagina tavolo
- Status picker (L/O/I/CHIUSO — chiusura richiede conferma)
- Coperti modificabili con `+/-` (obbligatori per poter inviare)
- Storico invii con timestamp
- Totale parziale sempre visibile

### Schermata ordine (split 50/50)
- Sinistra: menu per categoria scrollabile, piatti con nome e prezzo
- Destra: riepilogo articoli con etichette `INVIATO` / `NON INVIATO` + totale
- Pulsante `INVIA` con conferma obbligatoria

### Pannello varianti
- Piatti: quantità, porzione, cottura (solo secondi), note
- Pizze: dropdown base/impasto/mozzarella + ingredienti con (-/●/+) + taglio + note + prezzo live

### Navigazione
- Barra fissa in basso: Tavoli / Ordine / Totale
- PIN di sblocco (default 1234) dopo 5 min inattività
- Stato PWA preservato su uscita accidentale
- Admin può forzare logout da remoto

---

## 6. Backoffice admin

### Gestione menu
- Categorie espandibili con lista piatti
- Per piatto: nome, descrizione, prezzo, toggle disponibilità, ingredienti default
- Archivio ingredienti centralizzato (cucina separato da pizzeria)
- Disattivazione temporanea senza eliminazione

### Gestione tavoli e zone
- Aggiunta/eliminazione tavoli per zona (solo se `L`)
- Zone rinominabili
- Zona Fuori: abilitazione definitiva da backend

### Camerieri
- Campi: nome, cognome, username, password, PIN tablet
- Stato: attivo / disattivato (dati conservati)
- Accesso solo al tablet, non al backoffice

### Stampanti
- Configurazione: IP, porta, reparto, nome
- Test stampa dal backoffice
- Architettura N stampanti (assegnazione reparto senza toccare codice)

### Service schedule
- Giorni attività per reparto (cucina / pizzeria) separatamente
- Giorno non attivo → categoria nascosta sul tablet

### Report
Fatturato giornaliero, piatti più ordinati, coperti medi, fatturato per fascia oraria,
ingredienti pizza più richiesti, spesa media per coperto, confronto settimanale/mensile,
performance camerieri. Tutti esportabili in PDF.

### Chiusura giornaliera
1. Verifica tavoli aperti
2. Avviso se presenti (forza o torna)
3. Genera PDF report
4. Blocca dati giornata (`status = locked`)

### Impostazioni
- PIN tablet configurabile
- Messaggi di sistema personalizzabili
- Log attività (chi, cosa, quando)

---

## 7. Casi limite

| Scenario | Comportamento |
|---|---|
| Stampante offline | Notifica visibile + PDF backup + retry automatico in background |
| Perdita connessione durante invio | Salva in coda locale (Service Worker) + invia al reconnect |
| Inattività 5 min | Richiede PIN (configurabile da backoffice) |
| Annullamento articolo già inviato | No stampa — gestione a voce |
| Modifica menu con ordini aperti | Le modifiche si applicano solo agli ordini successivi |
| Ingrediente di default disattivato | Pizza ordinabile senza — prezzo decrementato |
| Ingrediente aggiuntivo disattivato | Non selezionabile dal cameriere |
| Tavoli aperti a fine serata | Segnalati durante procedura chiusura giornaliera |
