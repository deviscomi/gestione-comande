<?php

use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CashierController;
use App\Http\Controllers\Api\V1\KdsController;
use App\Http\Controllers\Api\V1\LicenseController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\DailyClosureController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DataPortabilityController;
use App\Http\Controllers\Api\V1\DishController;
use App\Http\Controllers\Api\V1\DishVariantGroupController;
use App\Http\Controllers\Api\V1\FiscalDeviceController;
use App\Http\Controllers\Api\V1\FiscalReceiptController;
use App\Http\Controllers\Api\V1\IngredientCategoryController;
use App\Http\Controllers\Api\V1\IngredientController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\OrderItemController;
use App\Http\Controllers\Api\V1\OrderSendController;
use App\Http\Controllers\Api\V1\PizzaController;
use App\Http\Controllers\Api\V1\PizzaIngredientController;
use App\Http\Controllers\Api\V1\PizzaVariantController;
use App\Http\Controllers\Api\V1\PrintController;
use App\Http\Controllers\Api\V1\PrinterController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ServiceScheduleController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\TableController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WineController;
use App\Http\Controllers\Api\V1\WineQuantityController;
use App\Http\Controllers\Api\V1\ZoneController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

// ── Health check (pubblico) ───────────────────────────────────────────────
Route::get('v1/health', fn () => response()->json(['status' => 'ok']));

// ── KDS — Kitchen Display System (PUBBLICO: display cucina/pizzeria senza login) ──
Route::prefix('v1/kds')->group(function () {
    Route::get('queue',                       [KdsController::class, 'queue']);
    Route::patch('statuses/{kdsStatus}',      [KdsController::class, 'updateStatus']);
    Route::patch('statuses/{kdsStatus}/call', [KdsController::class, 'call']);
});

Route::prefix('v1')->group(function () {

    // ── Auth (pubblico) ───────────────────────────────────────────────────
    Route::post('auth/login', [AuthController::class, 'login']);

    // ── Autenticati ───────────────────────────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        // Broadcasting auth per canali privati (Reverb + Sanctum)
        Route::post('broadcasting/auth', function (Request $request) {
            return Broadcast::auth($request);
        });

        // Auth
        Route::post('auth/logout',                  [AuthController::class, 'logout']);
        Route::get('auth/me',                       [AuthController::class, 'me']);
        Route::post('auth/refresh',                 [AuthController::class, 'refresh']);
        Route::post('auth/force-logout/{user}',     [AuthController::class, 'forceLogout'])
            ->middleware('role:admin');

        // ── Licenza & Moduli ──────────────────────────────────────────────
        Route::get('license', [LicenseController::class, 'show']);
        Route::put('license', [LicenseController::class, 'update'])->middleware('role:admin');

        // ── Settings (index admin, show entrambi, update admin) ──────────
        Route::get('settings',       [SettingsController::class, 'index'])->middleware('role:admin');
        Route::put('settings',       [SettingsController::class, 'bulkUpdate'])->middleware('role:admin');
        Route::get('settings/{key}', [SettingsController::class, 'show']);
        Route::put('settings/{key}', [SettingsController::class, 'update'])->middleware('role:admin');

        // ── Service Schedule ──────────────────────────────────────────────
        Route::get('service-schedule/today', [ServiceScheduleController::class, 'today']);
        Route::get('service-schedule',       [ServiceScheduleController::class, 'index']);
        Route::put('service-schedule',       [ServiceScheduleController::class, 'update'])
            ->middleware('role:admin');

        // ── Menu — Cucina (AGENT_03) ──────────────────────────────────────
        Route::apiResource('categories', CategoryController::class)->only(['index', 'show']);
        Route::apiResource('categories', CategoryController::class)
            ->except(['index', 'show'])->middleware('role:admin');
        Route::patch('categories/{category}/toggle', [CategoryController::class, 'toggle'])
            ->middleware('role:admin');

        Route::apiResource('dishes', DishController::class)->only(['index', 'show']);
        Route::apiResource('dishes', DishController::class)
            ->except(['index', 'show'])->middleware('role:admin');
        Route::patch('dishes/{dish}/toggle', [DishController::class, 'toggle'])
            ->middleware('role:admin');

        Route::apiResource('ingredients', IngredientController::class)->only(['index', 'show']);
        Route::apiResource('ingredients', IngredientController::class)
            ->except(['index', 'show'])->middleware('role:admin');
        Route::patch('ingredients/{ingredient}/toggle', [IngredientController::class, 'toggle'])
            ->middleware('role:admin');

        Route::apiResource('ingredient-categories', IngredientCategoryController::class)->only(['index', 'show']);
        Route::apiResource('ingredient-categories', IngredientCategoryController::class)
            ->except(['index', 'show'])->middleware('role:admin');
        Route::patch('ingredient-categories/{ingredientCategory}/toggle', [IngredientCategoryController::class, 'toggle'])
            ->middleware('role:admin');

        Route::apiResource('dish-variant-groups', DishVariantGroupController::class)->only(['index', 'show']);
        Route::apiResource('dish-variant-groups', DishVariantGroupController::class)
            ->except(['index', 'show'])->middleware('role:admin');
        Route::patch('dish-variant-groups/{dishVariantGroup}/toggle', [DishVariantGroupController::class, 'toggle'])
            ->middleware('role:admin');

        // ── Menu — Vini ────────────────────────────────────────────────────
        Route::get('/wine-quantities', [WineQuantityController::class, 'index']);
        Route::middleware('role:admin')->group(function () {
            Route::post('/wine-quantities', [WineQuantityController::class, 'store']);
            Route::put('/wine-quantities/{wineQuantity}', [WineQuantityController::class, 'update']);
            Route::delete('/wine-quantities/{wineQuantity}', [WineQuantityController::class, 'destroy']);
            Route::patch('/wine-quantities/{wineQuantity}/toggle', [WineQuantityController::class, 'toggle']);
        });

        Route::apiResource('wines', WineController::class)->only(['index', 'show']);
        Route::apiResource('wines', WineController::class)
            ->except(['index', 'show'])->middleware('role:admin');
        Route::patch('wines/{wine}/toggle', [WineController::class, 'toggle'])
            ->middleware('role:admin');

        // ── Menu — Pizzeria (AGENT_03) ────────────────────────────────────
        Route::apiResource('pizzas', PizzaController::class)->only(['index', 'show'])->middleware('module:pizzeria');
        Route::apiResource('pizzas', PizzaController::class)
            ->except(['index', 'show'])->middleware(['role:admin', 'module:pizzeria']);
        Route::patch('pizzas/{pizza}/toggle', [PizzaController::class, 'toggle'])
            ->middleware(['role:admin', 'module:pizzeria']);

        Route::apiResource('pizza-ingredients', PizzaIngredientController::class)->only(['index', 'show'])->middleware('module:pizzeria');
        Route::apiResource('pizza-ingredients', PizzaIngredientController::class)
            ->except(['index', 'show'])->middleware(['role:admin', 'module:pizzeria']);
        Route::patch('pizza-ingredients/{pizzaIngredient}/toggle', [PizzaIngredientController::class, 'toggle'])
            ->middleware(['role:admin', 'module:pizzeria']);

        Route::apiResource('pizza-variants', PizzaVariantController::class)->only(['index', 'show'])->middleware('module:pizzeria');
        Route::apiResource('pizza-variants', PizzaVariantController::class)
            ->except(['index', 'show'])->middleware(['role:admin', 'module:pizzeria']);
        Route::patch('pizza-variants/{pizzaVariant}/toggle', [PizzaVariantController::class, 'toggle'])
            ->middleware(['role:admin', 'module:pizzeria']);

        // ── Zone & Tavoli (AGENT_04) ──────────────────────────────────────
        Route::apiResource('zones', ZoneController::class)->only(['index', 'show']);
        Route::apiResource('zones', ZoneController::class)->except(['index', 'show'])->middleware('role:admin');
        Route::patch('zones/{zone}/toggle', [ZoneController::class, 'toggle']); // entrambi — guard in controller

        Route::apiResource('tables', TableController::class)->only(['index', 'show']);
        Route::apiResource('tables', TableController::class)->except(['index', 'show'])->middleware('role:admin');
        Route::patch('tables/{table}/status',     [TableController::class, 'updateStatus']);
        Route::patch('tables/{table}/covers',     [TableController::class, 'updateCovers']);
        Route::post('tables/{table}/duplicate',   [TableController::class, 'duplicate']);
        Route::delete('tables/{table}/duplicate', [TableController::class, 'removeDuplicate']);
        Route::patch('tables/{table}/move-order', [TableController::class, 'moveOrder']);

        // ── Ordini (AGENT_04) ─────────────────────────────────────────────
        Route::get('orders/active',  [OrderController::class, 'active']);
        Route::get('orders/history', [OrderController::class, 'history'])->middleware('role:admin,cashier');
        Route::get('orders',         [OrderController::class, 'index'])->middleware('role:admin');
        Route::apiResource('orders', OrderController::class)->only(['show', 'store', 'destroy']);
        Route::patch('orders/{order}/close',     [OrderController::class, 'close']);
        Route::post('orders/{order}/pre-conto', [OrderController::class, 'preConto']);
        Route::get('orders/{order}/pre-conto/pdf', [OrderController::class, 'preContoPdf']);
        Route::get('orders/{order}/print-jobs', [OrderController::class, 'printJobs']);
        Route::get('orders/{order}/kds-status',  [OrderController::class, 'kdsStatus']);

        Route::get('orders/{order}/items',            [OrderItemController::class, 'index']);
        Route::post('orders/{order}/items',           [OrderItemController::class, 'store']);
        Route::patch('orders/{order}/items/{item}',   [OrderItemController::class, 'update']);
        Route::delete('orders/{order}/items/{item}',  [OrderItemController::class, 'destroy']);

        Route::post('orders/{order}/send',                 [OrderSendController::class, 'send']);
        Route::get('orders/{order}/sends',                 [OrderSendController::class, 'index']);
        Route::get('orders/{order}/sends/{send}',          [OrderSendController::class, 'show']);
        Route::post('orders/{order}/sends/{send}/reprint', [OrderSendController::class, 'reprint'])
            ->middleware('module:printing');

        // ── Backoffice condiviso — admin + cashier (pannello cassiere) ─────
        Route::middleware('role:admin,cashier')->group(function () {
            // Dashboard
            Route::get('dashboard',         [DashboardController::class, 'index']);
            Route::get('dashboard/summary', [DashboardController::class, 'summary']);

            // Stampanti — sola lettura (serve a Reports.jsx per "Stampa Cassa")
            Route::apiResource('printers', PrinterController::class)->only(['index', 'show'])
                ->middleware('module:printing');

            // Storico scontrini fiscali
            Route::get('fiscal-receipts', [FiscalReceiptController::class, 'index'])
                ->middleware('module:fiscal');

            // Report
            Route::prefix('reports')->middleware('module:reports')->group(function () {
                Route::get('daily',          [ReportController::class, 'daily']);
                Route::get('dishes',         [ReportController::class, 'dishes']);
                Route::get('wines',          [ReportController::class, 'wines']);
                Route::get('covers',         [ReportController::class, 'covers']);
                Route::get('hourly',         [ReportController::class, 'hourly']);
                Route::get('pizza-toppings', [ReportController::class, 'pizzaToppings']);
                Route::get('spend-per-cover',[ReportController::class, 'spendPerCover']);
                Route::get('weekly',         [ReportController::class, 'weekly']);
                Route::get('monthly',        [ReportController::class, 'monthly']);
                Route::get('waiters',        [ReportController::class, 'waiters']);
                Route::post('export',        [ReportController::class, 'export']);
                Route::post('print-thermal', [ReportController::class, 'printThermal']);
            });

            // Chiusura giornaliera
            Route::middleware('module:daily_closure')->group(function () {
                Route::get('daily-closures',                  [DailyClosureController::class, 'index']);
                Route::get('daily-closures/check',            [DailyClosureController::class, 'check']);
                Route::post('daily-closures',                 [DailyClosureController::class, 'store']);
                Route::get('daily-closures/{closure}',        [DailyClosureController::class, 'show']);
                Route::get('daily-closures/{closure}/report', [DailyClosureController::class, 'downloadReport']);
                Route::post('daily-closures/{closure}/print-thermal', [DailyClosureController::class, 'printThermal']);
            });
        });

        // ── Cassa — pagamenti parziali / conti separati ───────────────────
        Route::prefix('cassa')->middleware('role:cashier,admin')->group(function () {
            Route::get('orders',                       [CashierController::class, 'orders']);
            Route::get('orders/{order}/payment-status', [CashierController::class, 'paymentStatus']);
            Route::post('orders/{order}/payments',      [CashierController::class, 'storePayment']);
            Route::post('payments/{payment}/void',       [CashierController::class, 'voidPayment']);

            Route::get('payments/{payment}/fiscal-receipt',        [FiscalReceiptController::class, 'show']);
            Route::post('payments/{payment}/fiscal-receipt',       [FiscalReceiptController::class, 'emit']);
            Route::post('payments/{payment}/fiscal-receipt/retry', [FiscalReceiptController::class, 'retry']);
            Route::post('payments/{payment}/fiscal-receipt/skip',  [FiscalReceiptController::class, 'skip']);
        });

        // ── Stampa (AGENT_05) ─────────────────────────────────────────────
        Route::get('print-jobs',               [PrintController::class, 'index']);
        Route::get('print-jobs/pending',       [PrintController::class, 'pending']);
        Route::get('print-jobs/failed',        [PrintController::class, 'failed']);
        Route::delete('print-jobs/failed',     [PrintController::class, 'destroyFailed']);
        Route::get('print-jobs/{job}',         [PrintController::class, 'show']);
        Route::post('print-jobs/{job}/retry',  [PrintController::class, 'retry'])->middleware('module:printing');
        Route::post('print-jobs/{job}/reprint',[PrintController::class, 'reprint'])->middleware('module:printing');

        // ── Backoffice — admin only (AGENT_06) ────────────────────────────
        Route::middleware('role:admin')->group(function () {

            // Utenti
            Route::middleware('module:advanced_backoffice')->group(function () {
                Route::apiResource('users', UserController::class);
                Route::patch('users/{user}/toggle', [UserController::class, 'toggle']);
                Route::patch('users/{user}/pin',    [UserController::class, 'updatePin']);
            });

            // Stampanti (CRUD di scrittura — la lettura index/show è condivisa con il cashier sopra)
            Route::middleware('module:printing')->group(function () {
                Route::apiResource('printers', PrinterController::class)->except(['index', 'show']);
                Route::patch('printers/{printer}/toggle', [PrinterController::class, 'toggle']);
                Route::post('printers/{printer}/test',    [PrinterController::class, 'test']);
            });

            // Registratori telematici (scontrini fiscali) — lo storico (index) è condiviso col cashier sopra
            Route::middleware('module:fiscal')->group(function () {
                Route::apiResource('fiscal-devices', FiscalDeviceController::class)
                    ->parameters(['fiscal-devices' => 'fiscalDevice']);
                Route::patch('fiscal-devices/{fiscalDevice}/toggle', [FiscalDeviceController::class, 'toggle']);
                Route::post('fiscal-devices/{fiscalDevice}/test',    [FiscalDeviceController::class, 'test']);
            });

            // Activity log
            Route::middleware('module:advanced_backoffice')->group(function () {
                Route::get('activity-logs',         [ActivityLogController::class, 'index']);
                Route::get('activity-logs/actions', [ActivityLogController::class, 'actions']);
                Route::get('activity-logs/count',   [ActivityLogController::class, 'countBefore']);
                Route::delete('activity-logs',      [ActivityLogController::class, 'purge']);
                Route::get('activity-logs/{log}',   [ActivityLogController::class, 'show']);
            });

            // Import/Export dati di configurazione
            Route::prefix('data')->middleware('module:advanced_backoffice')->group(function () {
                Route::get('groups',          [DataPortabilityController::class, 'groups']);
                Route::post('export',         [DataPortabilityController::class, 'export']);
                Route::post('import/preview', [DataPortabilityController::class, 'preview']);
                Route::post('import',         [DataPortabilityController::class, 'import']);
            });
        });
    });
});
