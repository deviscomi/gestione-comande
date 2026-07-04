# Implementazione Sistema Uscite — Gestione Comande

## Contesto e obiettivo

Devi implementare il sistema delle **uscite** nell'applicazione di gestione comande
di un ristorante-pizzeria.

**Prima di tutto:** leggi attentamente questi file:
- `CLAUDE.md` — regole generali del progetto
- `docs/DRF.md` — requisiti funzionali
- `docs/SCHEMA_DB.md` — schema database attuale
- `docs/API_REST.md` — mappa endpoint
- `docs/agents/AGENT_04_api_ordini.md` — logica ordini
- `docs/agents/AGENT_05_print.md` — sistema stampa ESC/POS
- `docs/agents/AGENT_07_frontend_tablet.md` — interfaccia cameriere

---

## Il problema da risolvere

L'app attualmente gestisce le portate in modo fisso basato sulla categoria del piatto
(Antipasti → Primi → Secondi → ecc.). Questo non rispecchia la realtà operativa
del ristorante, dove i clienti ordinano in "uscite" personalizzate che mischiano
le categorie.

**Esempio reale:**
```
Uscita 1: Bruschetta (Antipasto) + Patatine (Contorno) + Diavola (Pizza)
Uscita 2: Spaghetti (Primo) + Margherita (Pizza)
Uscita 3: Tagliata (Secondo) + Insalata mista (Contorno)
```

**Principio fondamentale:**
- La **categoria** definisce COSA è il piatto (non cambia)
- L'**uscita** definisce QUANDO esce il piatto (nuovo campo)

Sono due dimensioni completamente separate e indipendenti.

---

## Specifiche tecniche complete

### 1. DATABASE — Migrazione

Crea una nuova migrazione Laravel:
`add_uscita_to_order_items_table`

```php
Schema::table('order_items', function (Blueprint $table) {
    $table->unsignedTinyInteger('uscita')
          ->default(1)
          ->after('sort_order')
          ->comment('Numero uscita (portata personalizzata): 1, 2, 3...');
});
```

**Vincoli:**
- Tipo: `TINYINT UNSIGNED` (max 255, in pratica non supererà 9)
- Default: `1` — retrocompatibilità totale con ordini esistenti
- Non nullable
- Valore minimo: 1, valore massimo consigliato: 9

---

### 2. BACKEND — Model OrderItem

File: `app/Models/OrderItem.php`

**Aggiungi `uscita` a `$fillable`:**
```php
protected $fillable = [
    // ...campi esistenti...
    'uscita',
];
```

**Aggiungi cast:**
```php
protected $casts = [
    // ...cast esistenti...
    'uscita' => 'integer',
];
```

---

### 3. BACKEND — Validazione

File: `app/Http/Requests/StoreOrderItemRequest.php`
File: `app/Http/Requests/UpdateOrderItemRequest.php`

**Aggiungi regola:**
```php
'uscita' => 'sometimes|integer|min:1|max:9',
```

Il campo è opzionale (`sometimes`) — se non fornito, il model usa il default del DB (1).

---

### 4. BACKEND — API Resource

File: `app/Http/Resources/OrderItemResource.php`

**Aggiungi `uscita` nella risposta:**
```php
'uscita' => $this->uscita,
```

---

### 5. BACKEND — Controller OrderItem

File: `app/Http/Controllers/Api/V1/OrderItemController.php`

Nel metodo `store()`, assicurati che `uscita` venga passato alla creazione:
```php
$item = OrderItem::create([
    // ...campi esistenti...
    'uscita' => $request->input('uscita', 1),
]);
```

Nel metodo `update()`, consenti la modifica dell'uscita su item in status `pending`:
```php
if ($request->has('uscita') && $item->status === 'pending') {
    $item->update(['uscita' => $request->uscita]);
}
```

---

### 6. BACKEND — PrintDispatcher

File: `app/Services/PrintDispatcher.php`

La logica di determinazione delle stampanti da attivare **non cambia**.
Cambia il modo in cui i dati vengono passati ai template.

Aggiungi un metodo helper per raggruppare gli articoli per uscita:

```php
/**
 * Raggruppa gli articoli per uscita, poi per categoria all'interno di ogni uscita.
 * Restituisce una collection ordinata per uscita ASC.
 */
public static function groupByUscita(Collection $items): Collection
{
    return $items
        ->sortBy('uscita')
        ->groupBy('uscita')
        ->map(function ($uscitaItems) {
            return $uscitaItems->groupBy(function ($item) {
                if ($item->item_type === 'pizza') return 'pizze';
                return $item->dish?->category?->department ?? 'cucina';
            });
        });
}

/**
 * Per una data uscita, verifica se contiene articoli di cucina
 * (antipasti, primi, secondi, contorni) oltre alle pizze.
 */
public static function uscitaHasCucina(Collection $uscitaItems): bool
{
    return $uscitaItems->flatten(1)->contains(function ($item) {
        return $item->item_type === 'dish'
            && in_array(
                $item->dish?->category?->department,
                ['cucina'] // antipasti, primi, secondi, contorni
            );
    });
}
```

---

### 7. BACKEND — EscPosRenderer — Template CASSIERE

File: `app/Services/EscPosRenderer.php` — metodo `renderCassiere()`

**Struttura stampa aggiornata:**

```
[HEADER: Tavolo, Coperti, Ora, Cameriere, #Comanda]
[*** RISTAMPA *** se is_reprint]
────────────────────────────────

━━━ USCITA 1 ━━━━━━━━━━━━━━━━━━   ← NUOVO SEPARATORE PER USCITA
ANTIPASTI
  x1  Bruschetta al pomodoro    € 6.00
      > ABBONDANTE

CONTORNI
  x1  Patatine fritte           € 4.00

PIZZE
  x1  Diavola (R)               € 9.00
      +funghi, -salame

━━━ USCITA 2 ━━━━━━━━━━━━━━━━━━
PRIMI
  x2  Spaghetti carbonara       €18.00

PIZZE
  x1  Margherita (M)            € 8.00
────────────────────────────────
TOTALE  EUR  45.00
```

**Regola:** se tutti gli articoli hanno uscita 1 (ordine semplice),
mostra comunque il separatore `━━━ USCITA 1` per coerenza visiva.

**Implementazione:**
```php
private static function renderCassiere(PrintJob $job): string
{
    $order = $job->order;
    $send  = $job->orderSend;
    $items = $send->items()->with(['dish.category', 'pizza', 'modifications'])
                  ->where('status', 'sent')
                  ->orderBy('uscita')
                  ->get();

    $grouped = PrintDispatcher::groupByUscita($items);

    $output = self::RESET . self::CENTER;
    // Header...
    $output .= self::LEFT . self::DIVIDER . self::LF;

    foreach ($grouped as $uscitaNum => $categorieItems) {
        // Separatore uscita
        $output .= self::BOLD_ON
                 . self::FONT_DOUBLE
                 . "USCITA {$uscitaNum}"
                 . self::FONT_NORMAL
                 . self::BOLD_OFF
                 . self::LF;

        foreach ($categorieItems as $dept => $deptItems) {
            $output .= self::BOLD_ON . strtoupper($dept) . self::BOLD_OFF . self::LF;
            foreach ($deptItems as $item) {
                $output .= self::formatItemCassiere($item);
            }
        }
        $output .= self::LF;
    }

    $output .= self::DIVIDER . self::LF;
    $output .= self::BOLD_ON . self::FONT_DOUBLE
             . "TOTALE EUR " . number_format($order->total, 2)
             . self::FONT_NORMAL . self::BOLD_OFF . self::LF;
    $output .= self::LF . self::LF . self::CUT;

    return $output;
}
```

---

### 8. BACKEND — EscPosRenderer — Template CUCINA

File: `app/Services/EscPosRenderer.php` — metodo `renderCucina()`

**Struttura stampa aggiornata:**

```
[HEADER: Tavolo, Coperti, Ora, Cameriere, #Comanda]
[*** RISTAMPA *** se is_reprint]
[AGGIUNTA se invio successivo con solo dessert/bevande]
────────────────────────────────

━━━ USCITA 1 ━━━━━━━━━━━━━━━━━━
--- ANTIPASTI ---
  x1  Bruschetta al pomodoro
      > ABBONDANTE
      NOTE: senza aglio

--- CONTORNI ---
  x1  Patatine fritte

--- PIZZE [→ PIZZERIA] ---
  x1  Diavola (R, +funghi, -salame)
  x1  Margherita (M) SPICCHI

━━━ USCITA 2 ━━━━━━━━━━━━━━━━━━
--- PRIMI ---
  x2  Spaghetti alla carbonara
      > COTTURA: nessuna (è un primo)

--- PIZZE [→ PIZZERIA] ---
  x1  Diavola (R, CERE)
```

**Regole per la cucina:**
- Le pizze vengono mostrate nella loro uscita sotto `--- PIZZE [→ PIZZERIA] ---`
- Questo permette alla cucina di sapere quali ingredienti freschi preparare per la pizzeria
- Il separatore `[→ PIZZERIA]` segnala che quella sezione va coordinata con la pizzeria
- NO prezzi sulla stampa cucina
- Separatori portata dentro ogni uscita: `--- ANTIPASTI ---`, `--- PRIMI ---`, ecc.

**Implementazione:**
```php
private static function renderCucina(PrintJob $job): string
{
    $order = $job->order;
    $send  = $job->orderSend;
    $isSoloAggiunta = self::isSoloAggiuntaSecondaria($send);

    $items = $send->items()->with(['dish.category', 'pizza', 'modifications'])
                  ->where('status', 'sent')
                  ->orderBy('uscita')
                  ->get();

    $grouped = PrintDispatcher::groupByUscita($items);

    $output = self::RESET . self::CENTER;
    // Header...
    if ($isSoloAggiunta) {
        $output .= self::BOLD_ON . "--- AGGIUNTA ---" . self::BOLD_OFF . self::LF;
    }
    $output .= self::LEFT . self::DIVIDER . self::LF;

    foreach ($grouped as $uscitaNum => $categorieItems) {
        $output .= self::BOLD_ON . self::FONT_DOUBLE
                 . "USCITA {$uscitaNum}"
                 . self::FONT_NORMAL . self::BOLD_OFF . self::LF;

        foreach ($categorieItems as $dept => $deptItems) {
            $sectionLabel = $dept === 'pizze'
                ? "--- PIZZE [→ PIZZERIA] ---"
                : "--- " . strtoupper($dept) . " ---";

            $output .= self::BOLD_ON . $sectionLabel . self::BOLD_OFF . self::LF;

            foreach ($deptItems as $item) {
                $output .= self::formatItemCucina($item);
            }
        }
        $output .= self::LF;
    }

    $output .= self::LF . self::LF . self::CUT;
    return $output;
}
```

---

### 9. BACKEND — EscPosRenderer — Template PIZZERIA

File: `app/Services/EscPosRenderer.php` — metodo `renderPizzeria()`

**Struttura stampa aggiornata — CAMBIAMENTO SIGNIFICATIVO:**

I segnali ATTESA e CUCINA diventano **per-uscita**, non più globali in cima al foglio.

```
[HEADER: Tavolo, Coperti, Ora, #Comanda]
[*** RISTAMPA *** se is_reprint]
────────────────────────────────

USCITA 1  ★ CON CUCINA
────────────────────────────────
  [R] Diavola
      +funghi, -salame
      SPICCHI

  [M] Margherita
      META'

USCITA 2  ⏳ SOLO PIZZA
────────────────────────────────
  [CERE][B] Marinara
      +acciughe

USCITA 3  ★ CON CUCINA
────────────────────────────────
  [M] Quattro stagioni (NO LATT.)
```

**Logica segnali per uscita:**
- `★ CON CUCINA` → l'uscita ha SIA pizze SIA piatti di cucina: la pizzeria deve coordinarsi
- `⏳ SOLO PIZZA` → l'uscita ha solo pizze: la pizzeria può procedere subito
- Se un'uscita non ha pizze → non appare sulla stampa pizzeria (ovviamente)

**Implementazione:**
```php
private static function renderPizzeria(PrintJob $job): string
{
    $order = $job->order;
    $send  = $job->orderSend;

    // Prendi TUTTI gli articoli dell'ordine (non solo del send corrente)
    // per capire il contesto completo di ogni uscita
    $allItems = $order->items()
        ->with(['dish.category', 'pizza', 'modifications'])
        ->where('status', 'sent')
        ->orderBy('uscita')
        ->get();

    // Raggruppa per uscita
    $byUscita = $allItems->groupBy('uscita');

    $output = self::RESET . self::CENTER;
    // Header (no cameriere sulla pizzeria)
    $output .= self::formatHeaderPizzeria($order);
    $output .= self::LEFT . self::DIVIDER . self::LF;

    foreach ($byUscita as $uscitaNum => $uscitaItems) {
        $pizze   = $uscitaItems->where('item_type', 'pizza');
        $cucina  = $uscitaItems->where('item_type', 'dish');

        // Skip uscite senza pizze
        if ($pizze->isEmpty()) continue;

        $hasCucina = $cucina->isNotEmpty();
        $signal    = $hasCucina ? "USCITA {$uscitaNum}  \xE2\x98\x85 CON CUCINA"
                                : "USCITA {$uscitaNum}  \xE2\x8F\xB3 SOLO PIZZA";

        $output .= self::BOLD_ON . $signal . self::BOLD_OFF . self::LF;
        $output .= self::DIVIDER . self::LF;

        foreach ($pizze as $pizza) {
            $output .= self::formatPizzaPizzeria($pizza) . self::LF;
        }
        $output .= self::LF;
    }

    $output .= self::LF . self::LF . self::CUT;
    return $output;
}
```

**Metodo `formatPizzaPizzeria()`:**
Il formato di ogni pizza rimane invariato:
```
[CERE][R][NO LATT.] Nome Pizza (+ag, -rim, poco X)  SPICCHI
```
Solo le varianti diverse dal default vengono stampate.

---

### 10. FRONTEND — Store Zustand

File: `src/store/useOrderStore.js`

Aggiorna la struttura degli item pending per includere `uscita`:

```js
// Struttura item pending
{
  item_type: 'dish' | 'pizza',
  dish_id: null,
  pizza_id: null,
  quantity: 1,
  uscita: 1,          // ← NUOVO
  notes: '',
  modifications: [],
  unit_price: 0,
  total_price: 0,
}

// Aggiungi helper per ottenere il numero massimo di uscite usate
const getMaxUscita = () => {
    const allItems = [...get().pendingItems, ...get().sentItems];
    return Math.max(1, ...allItems.map(i => i.uscita ?? 1));
}
```

---

### 11. FRONTEND — ItemVariantDrawer

File: `src/components/tablet/ItemVariantDrawer.jsx`

Aggiungi il selettore uscita in fondo al pannello, prima delle note.

**Componente selettore uscita:**

```jsx
function UscitaSelector({ value, onChange, maxUscita }) {
  // Mostra i numeri da 1 fino a maxUscita + 1 (per aggiungere nuova uscita)
  const options = Array.from({ length: maxUscita + 1 }, (_, i) => i + 1);
  // Massimo 9 uscite
  const visibleOptions = options.slice(0, 9);

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 10
    }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Uscita
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {visibleOptions.map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              width: 30, height: 30,
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              fontWeight: value === n ? 600 : 400,
              fontSize: 13,
              background: value === n
                ? 'var(--color-background-info)'
                : 'var(--color-background-secondary)',
              color: value === n
                ? 'var(--color-text-info)'
                : 'var(--color-text-secondary)',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Integrazione nel drawer:**
```jsx
const [uscita, setUscita] = useState(defaultUscita ?? 1);
const { getMaxUscita } = useOrderStore();

// Recupera l'uscita massima già usata nell'ordine corrente
// così il cameriere vede le uscite già esistenti
const maxUscita = getMaxUscita();

// Nel corpo del drawer, prima di Note:
<UscitaSelector
  value={uscita}
  onChange={setUscita}
  maxUscita={maxUscita}
/>

// Quando l'utente clicca AGGIUNGI, includi uscita:
onAdd({
  ...otherFields,
  uscita,
});
```

---

### 12. FRONTEND — PizzaConfigurator

File: `src/components/tablet/PizzaConfigurator.jsx`

Stesso identico `UscitaSelector` dell'ItemVariantDrawer.

Aggiungilo prima del campo Note nella pizza.

```jsx
const [uscita, setUscita] = useState(defaultUscita ?? 1);

// Nel buildModifications, NON aggiungere uscita alle modifiche.
// L'uscita è un campo separato dell'order_item, non una modifica.

// Quando si chiama onAdd:
onAdd({
  modifications: buildModifications(),
  notes,
  unit_price: totalPrice,
  uscita,   // ← NUOVO campo separato
});
```

---

### 13. FRONTEND — OrderSummary

File: `src/components/tablet/OrderSummary.jsx`

Raggruppa gli articoli per uscita nella visualizzazione.

**Struttura visiva:**
```
USCITA 1
  x1 Bruschetta    [inviato]
  x1 Patatine      [inviato]
  x1 Diavola       [inviato]
──────────────────────────────
USCITA 2
  x2 Spaghetti     [inviato]
  x1 Margherita    [da inviare]
──────────────────────────────
Totale  € 45,00
```

**Implementazione:**
```jsx
// Raggruppa tutti gli item (inviati + pending) per uscita
const itemsByUscita = useMemo(() => {
  const all = [...(order?.items ?? []), ...pendingItems];
  return all.reduce((acc, item) => {
    const u = item.uscita ?? 1;
    if (!acc[u]) acc[u] = [];
    acc[u].push(item);
    return acc;
  }, {});
}, [order?.items, pendingItems]);

const usciteKeys = Object.keys(itemsByUscita).sort((a, b) => a - b);

// Nel render:
{usciteKeys.map(uscitaNum => (
  <div key={uscitaNum}>
    {/* Header uscita */}
    <div style={{
      fontSize: 11, fontWeight: 600,
      color: 'var(--color-text-secondary)',
      padding: '6px 0 3px',
      borderTop: uscitaNum > 1
        ? '1px solid var(--color-border-tertiary)'
        : 'none',
    }}>
      USCITA {uscitaNum}
    </div>

    {/* Items di questa uscita */}
    {itemsByUscita[uscitaNum].map(item => (
      <OrderItem key={item.id ?? item.tempId} item={item} />
    ))}
  </div>
))}
```

---

### 14. FRONTEND — Modifica uscita su item pending

Il cameriere deve poter modificare l'uscita di un articolo già aggiunto
ma non ancora inviato.

In `OrderItem.jsx` (componente singolo articolo nel riepilogo):

```jsx
// Se item.status === 'pending', mostra il selettore uscita inline
{item.status === 'pending' && (
  <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
      Uscita:
    </span>
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} onClick={() => onChangeUscita(item.tempId, n)}
        style={{
          width: 20, height: 20, borderRadius: 3,
          fontSize: 10, fontWeight: item.uscita === n ? 600 : 400,
          border: '1px solid var(--color-border-secondary)',
          background: item.uscita === n
            ? 'var(--color-background-info)'
            : 'var(--color-background-secondary)',
          color: item.uscita === n
            ? 'var(--color-text-info)'
            : 'var(--color-text-secondary)',
        }}>
        {n}
      </button>
    ))}
  </div>
)}
```

---

### 15. FRONTEND — API call aggiornata

File: `src/api/endpoints/orders.js` (o equivalente)

```js
// Aggiungi uscita nel body della POST /orders/{id}/items
export const addOrderItem = (orderId, itemData) =>
  api.post(`/orders/${orderId}/items`, {
    item_type:     itemData.item_type,
    dish_id:       itemData.dish_id,
    pizza_id:      itemData.pizza_id,
    quantity:      itemData.quantity,
    uscita:        itemData.uscita ?? 1,   // ← NUOVO
    notes:         itemData.notes,
    modifications: itemData.modifications,
  });
```

---

## Edge cases da gestire obbligatoriamente

### 1. Retrocompatibilità
Tutti gli ordini esistenti con `uscita = NULL` devono essere trattati come `uscita = 1`.
Usa `$item->uscita ?? 1` ovunque nel backend e `item.uscita ?? 1` nel frontend.

### 2. Ordini semplici (tutto uscita 1)
Se tutti gli articoli hanno uscita 1, la UX non cambia visivamente in modo
significativo — viene mostrato solo il separatore "USCITA 1" che non confonde.

### 3. Stampa con uscita unica
Se tutti gli articoli hanno la stessa uscita, il separatore appare comunque
per coerenza — non è un errore.

### 4. Pizzeria — uscita senza pizze
Se un'uscita ha solo piatti di cucina (nessuna pizza), non appare sulla
stampa pizzeria. Questo è il comportamento corretto.

### 5. Modifica uscita dopo l'invio
Un articolo con `status = 'sent'` NON può cambiare uscita — è già stato stampato.
Solo gli articoli `status = 'pending'` possono essere modificati.

### 6. Invio parziale per uscita
Il sistema NON gestisce l'invio selettivo per uscita — si invia sempre tutto
il pending insieme. La suddivisione in uscite serve solo alla cucina/pizzeria
per sapere l'ordine di uscita, non per triggherare invii separati.

---

## Ordine di implementazione consigliato

```
1. Migrazione database (uscita field)
2. Model OrderItem ($fillable, $casts)
3. Form Requests (validazione)
4. API Resource (risposta)
5. Controller OrderItem (store + update)
6. PrintDispatcher (helper groupByUscita, uscitaHasCucina)
7. EscPosRenderer — renderCassiere()
8. EscPosRenderer — renderCucina()
9. EscPosRenderer — renderPizzeria()
10. useOrderStore (struttura item + getMaxUscita)
11. UscitaSelector (componente riutilizzabile)
12. ItemVariantDrawer (integra UscitaSelector)
13. PizzaConfigurator (integra UscitaSelector)
14. OrderSummary (raggruppa per uscita)
15. OrderItem (modifica uscita su pending)
16. API call (includi uscita nel body)
17. Test end-to-end: aggiungi articoli, assegna uscite diverse, invia, verifica stampe
```

---

## Test di verifica finale

Dopo l'implementazione, verifica questi scenari:

**Scenario 1 — Ordine semplice (tutto uscita 1):**
- Aggiungi 3 piatti diversi senza cambiare uscita
- Invia → le 3 stampe devono mostrare "USCITA 1" con tutti i piatti

**Scenario 2 — Tre uscite miste:**
- Uscita 1: 1 Bruschetta + 1 Diavola
- Uscita 2: 2 Spaghetti + 1 Margherita
- Uscita 3: 1 Tagliata
- Stampa cucina: deve mostrare 3 sezioni separate con divisori USCITA
- Stampa pizzeria: deve mostrare USCITA 1 con "CON CUCINA" e USCITA 2 con "CON CUCINA"

**Scenario 3 — Pizza sola in un'uscita:**
- Uscita 1: 1 Bruschetta
- Uscita 2: 1 Margherita (solo pizza, nessuna cucina)
- Stampa pizzeria: USCITA 2 deve mostrare "SOLO PIZZA" (non "CON CUCINA")

**Scenario 4 — Modifica uscita su pending:**
- Aggiungi piatto con uscita 1
- Cambia uscita a 2 prima di inviare
- Invia → deve apparire nella sezione USCITA 2 sulla stampa

**Scenario 5 — Retrocompatibilità:**
- Esegui `php artisan migrate`
- Gli ordini esistenti devono continuare a funzionare senza errori
- Gli ordini esistenti vengono trattati come uscita 1

---

## Note finali

- Non modificare la logica di determinazione delle stampanti nel PrintDispatcher
  (quella logica — cassiere/cucina/pizzeria — rimane invariata)
- Non modificare la struttura del DB oltre al campo `uscita`
- Non modificare il flusso di invio (POST /send) — funziona già correttamente
- Il campo `uscita` NON è una "modifica" (order_item_mod) — è un campo diretto dell'order_item
- Mantieni la retrocompatibilità con `?? 1` ovunque si legge il campo uscita
