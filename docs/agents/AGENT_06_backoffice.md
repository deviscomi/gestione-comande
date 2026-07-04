# AGENT 06 — API Backend: Backoffice, Report & Chiusura

**Dipendenze:** AGENT_01 + 02 + 03 + 04 completati.
**Output atteso:** Camerieri, stampanti, schedule, impostazioni, tutti i report con export PDF, chiusura giornaliera, log.

---

## Obiettivo

Implementare il layer di gestione backoffice:
- CRUD camerieri con gestione PIN e force logout
- Configurazione stampanti con test print
- Service schedule per reparti
- System settings chiave-valore
- 9 tipi di report con export PDF
- Procedura chiusura giornaliera
- Activity logs con filtri e retention

---

## Controllers da creare

```
UserController.php          (camerieri)
PrinterController.php
ServiceScheduleController.php
SystemSettingController.php
ReportController.php
DailyClosureController.php
ActivityLogController.php
DashboardController.php
```

---

## Registrazione route

```php
// Backoffice — tutti admin tranne dove indicato
Route::middleware('role:admin')->group(function () {
    Route::apiResource('users', UserController::class);
    Route::patch('users/{user}/toggle', [UserController::class, 'toggle']);
    Route::patch('users/{user}/pin', [UserController::class, 'updatePin']);

    Route::apiResource('printers', PrinterController::class);
    Route::patch('printers/{printer}/toggle', [PrinterController::class, 'toggle']);
    Route::post('printers/{printer}/test', [PrinterController::class, 'test']);

    Route::get('service-schedule', [ServiceScheduleController::class, 'index']);
    Route::put('service-schedule', [ServiceScheduleController::class, 'update']);

    Route::get('settings', [SystemSettingController::class, 'index']);
    Route::put('settings', [SystemSettingController::class, 'update']);
    Route::put('settings/pin', [SystemSettingController::class, 'updatePin']);

    // Reports
    Route::prefix('reports')->group(function () {
        Route::get('daily', [ReportController::class, 'daily']);
        Route::get('dishes', [ReportController::class, 'dishes']);
        Route::get('covers', [ReportController::class, 'covers']);
        Route::get('hourly', [ReportController::class, 'hourly']);
        Route::get('pizza-toppings', [ReportController::class, 'pizzaToppings']);
        Route::get('spend-per-cover', [ReportController::class, 'spendPerCover']);
        Route::get('weekly', [ReportController::class, 'weekly']);
        Route::get('monthly', [ReportController::class, 'monthly']);
        Route::get('waiters', [ReportController::class, 'waiters']);
        Route::post('export', [ReportController::class, 'export']);
    });

    Route::get('daily-closures/check', [DailyClosureController::class, 'check']);
    Route::post('daily-closures', [DailyClosureController::class, 'store']);
    Route::get('daily-closures/{closure}', [DailyClosureController::class, 'show']);
    Route::get('daily-closures/{closure}/report', [DailyClosureController::class, 'downloadReport']);
    Route::get('daily-closures', [DailyClosureController::class, 'index']);

    Route::get('activity-logs', [ActivityLogController::class, 'index']);
    Route::get('activity-logs/{log}', [ActivityLogController::class, 'show']);

    Route::get('dashboard', [DashboardController::class, 'index']);
    Route::get('dashboard/summary', [DashboardController::class, 'summary']);
});

// Accessibili a entrambi i ruoli
Route::get('service-schedule/today', [ServiceScheduleController::class, 'today']);
Route::get('settings/{key}', [SystemSettingController::class, 'show']);
```

---

## UserController

```php
public function store(StoreUserRequest $request) {
    $user = User::create([
        ...$request->validated(),
        'password_hash' => Hash::make($request->password),
    ]);
    $this->logActivity('USER_CREATED', "Cameriere '{$user->username}' creato", $user);
    return new UserResource($user);
}

public function updatePin(Request $request, User $user) {
    $request->validate(['pin' => 'required|string|digits_between:4,6']);
    $user->update(['pin' => $request->pin]);
    $this->logActivity('PIN_CHANGED', "PIN cambiato per '{$user->username}'", $user);
    return new UserResource($user);
}

public function toggle(User $user) {
    if ($user->role === 'admin') {
        return response()->json(['message' => 'Non puoi disattivare un admin'], 422);
    }
    $user->update(['status' => $user->status === 'active' ? 'inactive' : 'active']);
    return new UserResource($user);
}
```

---

## PrinterController — test stampa

```php
public function test(Printer $printer) {
    $socket = @fsockopen($printer->ip_address, $printer->port, $errno, $errstr, 3);

    if (!$socket) {
        return response()->json([
            'success' => false,
            'message' => "Stampante non raggiungibile: {$errstr}"
        ], 503);
    }

    $payload = "\x1B@" // reset
        . "\x1Ba\x01" // center
        . "\x1BE\x01" // bold on
        . "TEST STAMPA\n"
        . "\x1BE\x00" // bold off
        . "Gestione Comande\n"
        . "Stampante: {$printer->name}\n"
        . "Reparto: {$printer->department}\n"
        . date("d/m/Y H:i:s") . "\n"
        . "--------------------------------\n\n"
        . "\x1DV\x42\x00"; // cut

    fwrite($socket, $payload);
    fclose($socket);

    return response()->json(['success' => true, 'message' => 'Test stampa inviato']);
}
```

---

## ServiceScheduleController

```php
public function today() {
    $today = now()->dayOfWeek; // Carbon: 0=Sunday, 1=Monday...
    // Converti a formato 0=Lun...6=Dom
    $dayIndex = ($today + 6) % 7;

    $cucina   = ServiceSchedule::where('department', 'cucina')
        ->where('day_of_week', $dayIndex)->value('is_active');
    $pizzeria = ServiceSchedule::where('department', 'pizzeria')
        ->where('day_of_week', $dayIndex)->value('is_active');

    return response()->json([
        'cucina'   => (bool) $cucina,
        'pizzeria' => (bool) $pizzeria,
        'day'      => $dayIndex,
    ]);
}

public function update(Request $request) {
    $request->validate([
        '*.department'   => 'required|in:cucina,pizzeria',
        '*.day_of_week'  => 'required|integer|between:0,6',
        '*.is_active'    => 'required|boolean',
    ]);

    foreach ($request->all() as $row) {
        ServiceSchedule::updateOrCreate(
            ['department' => $row['department'], 'day_of_week' => $row['day_of_week']],
            ['is_active'  => $row['is_active']]
        );
    }

    $this->logActivity('SCHEDULE_UPDATED', 'Calendario servizio aggiornato');
    return response()->json(['message' => 'Calendario aggiornato']);
}
```

---

## ReportService — query principali

```php
// Fatturato giornaliero
public function daily(string $date): array {
    $total = Order::whereDate('closed_at', $date)
        ->whereIn('status', ['closed', 'locked'])
        ->sum('total');

    $count = Order::whereDate('closed_at', $date)
        ->whereIn('status', ['closed', 'locked'])
        ->count();

    return ['date' => $date, 'total' => $total, 'orders_count' => $count];
}

// Piatti più ordinati
public function dishes(string $from, string $to, ?int $categoryId = null): Collection {
    return OrderItem::with('dish.category')
        ->whereBetween('created_at', [$from, $to . ' 23:59:59'])
        ->where('item_type', 'dish')
        ->where('status', '!=', 'cancelled')
        ->when($categoryId, fn($q) => $q->whereHas('dish', fn($q) => $q->where('category_id', $categoryId)))
        ->selectRaw('dish_id, SUM(quantity) as total_qty, SUM(total_price) as total_revenue')
        ->groupBy('dish_id')
        ->orderByDesc('total_qty')
        ->limit(20)
        ->get();
}

// Fatturato per fascia oraria
public function hourly(string $date): Collection {
    return Order::whereDate('first_sent_at', $date)
        ->whereIn('status', ['closed', 'locked'])
        ->selectRaw('HOUR(first_sent_at) as hour, SUM(total) as revenue, COUNT(*) as orders')
        ->groupBy('hour')
        ->orderBy('hour')
        ->get();
}

// Performance camerieri
public function waiters(string $from, string $to): Collection {
    return Order::with('user')
        ->whereBetween('closed_at', [$from, $to . ' 23:59:59'])
        ->whereIn('status', ['closed', 'locked'])
        ->selectRaw('user_id, COUNT(*) as tables_served, SUM(covers) as total_covers, SUM(total) as revenue')
        ->groupBy('user_id')
        ->get();
}
```

---

## DailyClosureController

```php
public function check() {
    $openTables = Table::with('zone')
        ->whereIn('status', ['occupato', 'in_corso'])->get();

    return response()->json([
        'can_close'   => $openTables->isEmpty(),
        'open_tables' => $openTables->map(fn($t) => [
            'id'     => $t->id,
            'number' => $t->number,
            'zone'   => $t->zone->name,
            'status' => $t->status,
        ]),
    ]);
}

public function store(Request $request) {
    $request->validate(['force' => 'boolean']);

    if (!$request->boolean('force')) {
        $openTables = Table::whereIn('status', ['occupato', 'in_corso'])->count();
        if ($openTables > 0) {
            return response()->json([
                'message' => 'Ci sono tavoli ancora aperti. Usa force=true per procedere comunque.'
            ], 422);
        }
    }

    $closure = DB::transaction(function () {
        // Blocca tutti gli ordini chiusi oggi
        Order::whereDate('closed_at', today())
            ->where('status', 'closed')
            ->update(['status' => 'locked']);

        // Genera PDF report
        $reportData = app(ReportService::class)->daily(today()->toDateString());
        $pdfPath = app(ReportService::class)->generateDailyPdf($reportData);

        $closure = DailyClosure::create([
            'closed_by'       => auth()->id(),
            'report_pdf_path' => $pdfPath,
        ]);

        $this->logActivity('DAILY_CLOSURE', "Chiusura giornaliera effettuata da " . auth()->user()->name);
        broadcast(new DashboardUpdated());

        return $closure;
    });

    return response()->json([
        'id'              => $closure->id,
        'closed_at'       => $closure->closed_at,
        'report_url'      => "/api/v1/daily-closures/{$closure->id}/report",
    ]);
}
```

---

## Pulizia automatica log — Scheduled Command

In `app/Console/Commands/CleanupLogs.php`:
```php
public function handle() {
    $cutoff = now()->subMonths(6);
    ActivityLog::where('created_at', '<', $cutoff)->delete();

    // Elimina anche PDF backup orfani
    PrintJob::where('status', 'failed')
        ->whereNotNull('pdf_backup_path')
        ->where('created_at', '<', $cutoff)
        ->each(function ($job) {
            Storage::delete($job->pdf_backup_path);
            $job->update(['pdf_backup_path' => null]);
        });
}
```

In `routes/console.php`: `Schedule::command('logs:cleanup')->monthly();`

---

## DashboardController

```php
public function index() {
    return response()->json([
        'zones'          => Zone::with(['tables' => fn($q) => $q->with('activeOrder')])->enabled()->get(),
        'open_tables'    => Table::whereIn('status', ['occupato', 'in_corso'])->count(),
        'total_covers'   => Order::where('status', 'open')->sum('covers'),
        'today_revenue'  => Order::whereDate('closed_at', today())->whereIn('status', ['closed','locked'])->sum('total'),
        'pending_prints' => PrintJob::where('status', 'pending')->count(),
        'failed_prints'  => PrintJob::where('status', 'failed')->count(),
    ]);
}
```

---

## Criteri di completamento

- [ ] `GET /api/v1/service-schedule/today` restituisce stato corretto per il giorno corrente
- [ ] `POST /printers/{id}/test` stampa foglio di prova fisicamente
- [ ] `GET /api/v1/reports/daily?date=2026-06-01` restituisce fatturato reale
- [ ] `POST /daily-closures` blocca ordini con `status=locked`
- [ ] `GET /daily-closures/check` elenca correttamente i tavoli aperti
- [ ] Export PDF report funzionante e scaricabile
- [ ] `GET /activity-logs` paginato con filtri funzionanti
- [ ] Job pulizia log registrato nello scheduler
- [ ] `GET /dashboard` restituisce snapshot sala in tempo reale
