# AGENT 04 — API Backend: Zone, Tavoli & Ordini

**Dipendenze:** AGENT_01 + AGENT_02 completati.
**Output atteso:** Flusso ordine completo — zone, tavoli bis/tris, apertura, articoli, invio (hook PrintDispatcher), chiusura.

---

## Obiettivo

Implementare tutta la logica operativa del sistema:
- Gestione zone e tavoli con macchina a stati
- Creazione e gestione ordini
- Aggiunta articoli con snapshot prezzi
- Endpoint `POST /send` che attiva PrintDispatcher (implementato da AGENT_05)

---

## Controllers da creare

```
ZoneController.php
TableController.php
OrderController.php
OrderItemController.php
OrderSendController.php
```

---

## Registrazione route

```php
// Zones
Route::apiResource('zones', ZoneController::class);
Route::patch('zones/{zone}/toggle', [ZoneController::class, 'toggle']);

// Tables
Route::apiResource('tables', TableController::class);
Route::patch('tables/{table}/status', [TableController::class, 'updateStatus']);
Route::patch('tables/{table}/covers', [TableController::class, 'updateCovers']);
Route::post('tables/{table}/duplicate', [TableController::class, 'duplicate']);
Route::delete('tables/{table}/duplicate', [TableController::class, 'removeDuplicate']);
Route::patch('tables/{table}/move-order', [TableController::class, 'moveOrder']);

// Orders
Route::get('orders/active', [OrderController::class, 'active']);
Route::get('orders/history', [OrderController::class, 'history']);
Route::apiResource('orders', OrderController::class)->except(['update']);
Route::patch('orders/{order}/close', [OrderController::class, 'close']);

// Order items
Route::apiResource('orders.items', OrderItemController::class)->except(['index', 'show']);
Route::get('orders/{order}/items', [OrderItemController::class, 'index']);

// Order sends
Route::post('orders/{order}/send', [OrderSendController::class, 'send']);
Route::get('orders/{order}/sends', [OrderSendController::class, 'index']);
Route::get('orders/{order}/sends/{send}', [OrderSendController::class, 'show']);
Route::post('orders/{order}/sends/{send}/reprint', [OrderSendController::class, 'reprint']);
Route::get('orders/{order}/print-jobs', [OrderController::class, 'printJobs']);
```

---

## TableController — logiche critiche

### duplicate()
```php
public function duplicate(Request $request, Table $table) {
    $request->validate(['suffix' => 'required|in:bis,tris']);
    $suffix = $request->suffix;

    // Se tris: verificare che esista il bis
    if ($suffix === 'tris') {
        $bisExists = Table::where('zone_id', $table->zone_id)
            ->where('number', $table->number)
            ->where('suffix', 'bis')->exists();
        if (!$bisExists) {
            return response()->json(['message' => 'Impossibile creare Tris senza Bis'], 422);
        }
    }

    $duplicate = Table::create([
        'zone_id'          => $table->zone_id,
        'parent_table_id'  => $table->id,
        'number'           => $table->number,
        'suffix'           => $suffix,
        'status'           => 'libero',
    ]);

    return response()->json(new TableResource($duplicate), 201);
}
```

### moveOrder()
```php
public function moveOrder(Request $request, Table $table) {
    $request->validate(['target_table_id' => 'required|exists:tables,id']);

    $order = Order::where('table_id', $table->id)
        ->where('status', 'open')->firstOrFail();

    $target = Table::findOrFail($request->target_table_id);

    // Verifica che il target non abbia ordini attivi
    if (Order::where('table_id', $target->id)->where('status', 'open')->exists()) {
        return response()->json(['message' => 'Tavolo di destinazione già occupato'], 422);
    }

    DB::transaction(function () use ($order, $table, $target) {
        $order->update(['table_id' => $target->id]);
        $table->update(['status' => 'libero']);
        $target->update(['status' => $order->first_sent_at ? 'in_corso' : 'occupato']);

        broadcast(new TableStatusChanged($table))->toOthers();
        broadcast(new TableStatusChanged($target))->toOthers();
    });

    $this->logActivity('ORDER_MOVED',
        "Ordine #{$order->order_number} spostato da {$table->number} a {$target->number}",
        $order
    );

    return response()->json(new OrderResource($order->fresh()));
}
```

---

## OrderController

### store() — apre tavolo
```php
public function store(StoreOrderRequest $request) {
    $table = Table::findOrFail($request->table_id);

    if (Order::where('table_id', $table->id)->where('status', 'open')->exists()) {
        return response()->json(['message' => 'Tavolo già ha un ordine aperto'], 422);
    }

    // Numero progressivo globale
    $orderNumber = (Order::max('order_number') ?? 0) + 1;

    $order = DB::transaction(function () use ($request, $table, $orderNumber) {
        $order = Order::create([
            'table_id'     => $table->id,
            'user_id'      => auth()->id(),
            'covers'       => 0,
            'order_number' => $orderNumber,
            'status'       => 'open',
        ]);
        $table->update(['status' => 'occupato']);
        broadcast(new TableStatusChanged($table));
        return $order;
    });

    $this->logActivity('ORDER_CREATED', "Ordine #{$order->order_number} aperto al tavolo {$table->number}", $order);
    return new OrderResource($order);
}
```

### close() — chiude tavolo
```php
public function close(Order $order) {
    if ($order->status === 'locked') {
        return response()->json(['message' => 'Ordine bloccato — non modificabile'], 422);
    }

    DB::transaction(function () use ($order) {
        // Elimina PDF backup se esistono
        $order->printJobs()->whereNotNull('pdf_backup_path')->each(function ($job) {
            if (Storage::exists($job->pdf_backup_path)) {
                Storage::delete($job->pdf_backup_path);
            }
            $job->update(['pdf_backup_path' => null]);
        });

        $order->update(['status' => 'closed', 'closed_at' => now()]);
        $order->table->update(['status' => 'libero']);
        broadcast(new TableStatusChanged($order->table));
    });

    $this->logActivity('TABLE_CLOSED',
        "Cameriere {$order->user->name} ha chiuso il Tav {$order->table->number} {$order->table->zone->name}",
        $order
    );

    return response()->noContent();
}
```

---

## OrderItemController

### store() — aggiunge articolo
```php
public function store(StoreOrderItemRequest $request, Order $order) {
    if ($order->status === 'locked') {
        return response()->json(['message' => 'Ordine bloccato'], 422);
    }

    // Calcola unit_price (snapshot)
    if ($request->item_type === 'dish') {
        $unitPrice = Dish::findOrFail($request->dish_id)->price;
    } else {
        $unitPrice = Pizza::findOrFail($request->pizza_id)->base_price;
    }

    // Calcola prezzo modifiche
    $modsTotal = collect($request->modifications ?? [])
        ->sum('price_change');

    $totalPrice = ($unitPrice + $modsTotal) * $request->quantity;

    $item = DB::transaction(function () use ($request, $order, $unitPrice, $totalPrice) {
        // Trova o crea un send "pending" per questo ordine (send temporaneo)
        $pendingSend = $order->sends()
            ->whereDoesntHave('printJobs')
            ->latest()->first()
            ?? $order->sends()->create(['send_number' => 0]); // send_number 0 = draft

        $item = OrderItem::create([
            'order_id'       => $order->id,
            'order_send_id'  => $pendingSend->id,
            'item_type'      => $request->item_type,
            'dish_id'        => $request->dish_id,
            'pizza_id'       => $request->pizza_id,
            'quantity'       => $request->quantity,
            'unit_price'     => $unitPrice,
            'total_price'    => $totalPrice,
            'status'         => 'pending',
            'notes'          => $request->notes,
            'sort_order'     => $this->getSortOrder($request->item_type, $order),
        ]);

        foreach ($request->modifications ?? [] as $mod) {
            $item->modifications()->create($mod);
        }

        $order->recalculateTotal();
        return $item;
    });

    return new OrderItemResource($item->load('modifications'));
}

private function getSortOrder(string $itemType, Order $order): int {
    // Ordina per portata: antipasti=1, primi=2, secondi=3, contorni=4, pizze=5, bevande=6, dessert=7, amari=8
    // Recupera la categoria dell'articolo e usa il sort_order della categoria
    return 0; // implementa logica basata su category.sort_order
}
```

---

## OrderSendController — send() — ENDPOINT PRINCIPALE

```php
public function send(Order $order) {
    // 1. Verifica coperti
    if ($order->covers <= 0) {
        return response()->json([
            'message' => 'Inserire il numero di coperti prima di inviare la comanda'
        ], 422);
    }

    // 2. Recupera articoli pending
    $pendingItems = $order->items()->where('status', 'pending')->get();
    if ($pendingItems->isEmpty()) {
        return response()->json(['message' => 'Nessun articolo da inviare'], 422);
    }

    $result = DB::transaction(function () use ($order, $pendingItems) {
        // 3. Crea order_send
        $sendNumber = $order->sends()->where('send_number', '>', 0)->max('send_number') + 1;
        $orderSend = $order->sends()->create(['send_number' => $sendNumber]);

        // 4. Aggiorna items: status=sent, assegna al send
        $pendingItems->each(fn($item) => $item->update([
            'status'        => 'sent',
            'order_send_id' => $orderSend->id,
        ]));

        // 5. Se primo invio reale
        if ($sendNumber === 1) {
            $order->update([
                'first_sent_at' => now(),
                'status'        => 'open', // rimane open, il tavolo va in_corso
            ]);
            $order->table->update(['status' => 'in_corso']);
            broadcast(new TableStatusChanged($order->table));
        }

        // 6. Ricalcola totale
        $order->recalculateTotal();

        // 7. Attiva PrintDispatcher
        $printJobs = PrintDispatcher::dispatch($order, $orderSend, $pendingItems);

        $this->logActivity('ORDER_SENT',
            "Comanda #{$order->order_number} inviata (invio #{$sendNumber})",
            $order
        );

        broadcast(new OrderSent($order, $orderSend));

        return [
            'send_id'      => $orderSend->id,
            'send_number'  => $sendNumber,
            'print_jobs'   => $printJobs->map(fn($j) => [
                'id'         => $j->id,
                'print_type' => $j->print_type,
                'status'     => $j->status,
            ]),
            'table_status' => $order->table->fresh()->status,
        ];
    });

    return response()->json($result);
}
```

---

## StoreOrderItemRequest

```php
public function rules(): array {
    return [
        'item_type'                    => 'required|in:dish,pizza',
        'dish_id'                      => 'required_if:item_type,dish|exists:dishes,id',
        'pizza_id'                     => 'required_if:item_type,pizza|exists:pizzas,id',
        'quantity'                     => 'required|integer|min:1',
        'notes'                        => 'nullable|string|max:500',
        'modifications'                => 'nullable|array',
        'modifications.*.mod_type'     => 'required|string|max:50',
        'modifications.*.mod_value'    => 'required|string|max:200',
        'modifications.*.price_change' => 'required|numeric',
    ];
}
```

---

## Criteri di completamento

- [ ] `POST /orders` crea ordine e imposta tavolo su 'occupato'
- [ ] `POST /orders/{id}/items` con pizza restituisce `total_price` corretto con modifiche
- [ ] `POST /orders/{id}/send` con `covers=0` restituisce 422
- [ ] `POST /orders/{id}/send` con items pending crea `order_sends` e chiama `PrintDispatcher::dispatch()`
- [ ] Primo invio: `table.status = 'in_corso'`, `order.first_sent_at` valorizzato
- [ ] `PATCH /orders/{id}/close` imposta `table.status = 'libero'` e cancella PDF backup
- [ ] `POST /tables/{id}/duplicate` con `suffix=tris` senza bis esistente → 422
- [ ] `PATCH /tables/{id}/move-order` aggiorna correttamente entrambi i tavoli
- [ ] Broadcast eventi WebSocket attivi su ogni cambio stato
