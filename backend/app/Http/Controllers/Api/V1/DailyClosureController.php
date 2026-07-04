<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\DashboardUpdated;
use App\Events\TableStatusChanged;
use App\Http\Controllers\Controller;
use App\Http\Resources\DailyClosureResource;
use App\Jobs\ProcessPrintJob;
use App\Models\DailyClosure;
use App\Models\Order;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Table;
use App\Services\ReportService;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DailyClosureController extends Controller
{
    use LogsActivity;

    public function __construct(private ReportService $reportService) {}

    public function index(): AnonymousResourceCollection
    {
        return DailyClosureResource::collection(
            DailyClosure::with('closedBy')->latest('closed_at')->paginate(30)
        );
    }

    public function show(DailyClosure $closure): DailyClosureResource
    {
        $closure->load('closedBy');
        return new DailyClosureResource($closure);
    }

    public function check(): JsonResponse
    {
        $openTables = Table::with('zone')
            ->whereIn('status', ['occupato', 'in_corso'])
            ->get();

        // Comande KDS ancora in preparazione o in attesa, raggruppate per ordine/tavolo:
        // mostrate come avviso non bloccante prima della chiusura.
        $kdsActive = \App\Models\KdsStatus::whereIn('status', ['pending', 'in_corso'])
            ->whereHas('order', fn ($q) => $q->where('status', 'open'))
            ->with('order.table.zone')
            ->get();

        $kdsComande = $kdsActive->groupBy('order_id')->map(function ($rows) {
            $table = $rows->first()->order->table;
            return [
                'order_id'     => $rows->first()->order_id,
                'table_number' => $table?->number,
                'zone'         => $table?->zone?->name,
                'count'        => $rows->count(),
            ];
        })->values();

        return response()->json([
            'can_close'   => $openTables->isEmpty(),
            'open_tables' => $openTables->map(fn($t) => [
                'id'     => $t->id,
                'number' => $t->number,
                'zone'   => $t->zone->name,
                'status' => $t->status,
            ]),
            'kds_in_preparazione'       => $kdsComande,
            'kds_in_preparazione_count' => $kdsComande->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['force' => 'boolean', 'notes' => 'nullable|string']);

        $force = $request->boolean('force');

        if (!$force) {
            $openCount = Table::whereIn('status', ['occupato', 'in_corso'])->count();
            if ($openCount > 0) {
                return response()->json([
                    'message' => "Ci sono {$openCount} tavoli ancora aperti. Usa force=true per procedere comunque.",
                ], 422);
            }
        }

        [$closure, $closedTables, $printJobsCount] = DB::transaction(function () use ($request, $force) {
            $closedTables = collect();

            if ($force) {
                $openTables = Table::whereIn('status', ['occupato', 'in_corso'])->get();
                foreach ($openTables as $table) {
                    $order = Order::where('table_id', $table->id)->where('status', 'open')->first();
                    if ($order) {
                        $order->forceClose();
                    } else {
                        $table->update(['status' => 'libero']);
                    }
                    $closedTables->push($table->fresh());
                }
            }

            // Blocca tutti gli ordini chiusi oggi (inclusi quelli appena chiusi forzatamente)
            Order::whereDate('closed_at', today())
                ->where('status', 'closed')
                ->update(['status' => 'locked']);

            // Genera PDF report
            $reportData = $this->reportService->daily(today()->toDateString());
            $pdfPath    = $this->reportService->generatePdf('daily', $reportData);

            $closure = DailyClosure::create([
                'closed_by'       => auth()->id(),
                'report_pdf_path' => $pdfPath,
                'notes'           => $request->notes,
                'is_locked'       => true,
            ]);

            // Azzera il contatore comanda: il prossimo ordine riparte da #0001
            DB::table('sequences')->where('name', 'order_number')->update(['value' => 0]);

            $printJobsCount = DB::table('print_jobs')->count();

            $this->logActivity('DAILY_CLOSURE',
                "Chiusura giornaliera del " . today()->toDateString() . " effettuata da " . auth()->user()->name
                . ". Tavoli chiusi forzatamente: {$closedTables->count()}."
                . " Numero comanda azzerato (prossimo ordine #0001)."
                . " Print job eliminati: {$printJobsCount}."
                . " Dati KDS (monitor cucina/pizzeria/bar) azzerati."
            );

            return [$closure, $closedTables, $printJobsCount];
        });

        // Svuota print_jobs e resetta l'auto increment FUORI dalla transazione di chiusura:
        // su MySQL/InnoDB un TRUNCATE causerebbe un commit implicito che romperebbe la transazione Laravel.
        DB::table('print_jobs')->delete();
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement("DELETE FROM sqlite_sequence WHERE name = 'print_jobs'");
        } else {
            DB::statement('ALTER TABLE print_jobs AUTO_INCREMENT = 1');
        }

        // Svuota anche i dati KDS: alla chiusura giornaliera tutti i monitor si azzerano.
        DB::table('kds_statuses')->delete();
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement("DELETE FROM sqlite_sequence WHERE name = 'kds_statuses'");
        } else {
            DB::statement('ALTER TABLE kds_statuses AUTO_INCREMENT = 1');
        }

        // Broadcast dopo commit: un errore di Reverb non invalida la chiusura già persistita
        foreach ($closedTables as $table) {
            broadcast(new TableStatusChanged($table));
        }
        broadcast(new DashboardUpdated());
        // I monitor KDS rifanno il fetch della coda (ora vuota)
        broadcast(new \App\Events\KdsStatusChanged(
            department: 'all',
            eventType:  'order_update',
            payload:    []
        ));

        return response()->json(new DailyClosureResource($closure->load('closedBy')), 201);
    }

    public function downloadReport(DailyClosure $closure): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        if (!$closure->report_pdf_path || !Storage::exists($closure->report_pdf_path)) {
            abort(404, 'Report PDF non trovato');
        }
        return response()->download(Storage::path($closure->report_pdf_path));
    }

    public function printThermal(DailyClosure $closure): JsonResponse
    {
        $printer = Printer::where('department', 'cassiere')
            ->where('is_active', true)
            ->first();

        if (!$printer) {
            return response()->json(['error' => 'Stampante cassa non configurata'], 400);
        }

        $job = PrintJob::create([
            'order_id'      => null,
            'order_send_id' => null,
            'printer_id'    => $printer->id,
            'print_type'    => 'report_thermal',
            'status'        => 'pending',
            'attempts'      => 0,
            'is_reprint'    => false,
            'meta'          => [
                'report_type' => 'daily',
                'report_date' => $closure->closed_at->toDateString(),
            ],
        ]);

        ProcessPrintJob::dispatch($job->id)->onQueue('printing');

        return response()->json(['success' => true, 'job_id' => $job->id]);
    }
}
