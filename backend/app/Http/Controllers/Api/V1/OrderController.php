<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\TableStatusChanged;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Http\Resources\PrintJobResource;
use App\Jobs\ProcessPrintJob;
use App\Models\Order;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\SystemSetting;
use App\Models\Table;
use App\Services\PdfBackupGenerator;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Order::with(['table', 'table.zone', 'user']);
        if ($request->has('status'))   $q->where('status',   $request->status);
        if ($request->has('table_id')) $q->where('table_id', $request->table_id);
        if ($request->has('user_id'))  $q->where('user_id',  $request->user_id);
        if ($request->has('from'))     $q->whereDate('opened_at', '>=', $request->from);
        if ($request->has('to'))       $q->whereDate('opened_at', '<=', $request->to);
        return OrderResource::collection($q->latest('opened_at')->paginate(50));
    }

    public function active(): AnonymousResourceCollection
    {
        return OrderResource::collection(
            Order::with(['table', 'table.zone'])
                ->where('status', 'open')
                ->latest('opened_at')
                ->get()
        );
    }

    public function history(Request $request): AnonymousResourceCollection
    {
        $q = Order::with(['table', 'table.zone', 'user'])
            ->whereIn('status', ['closed', 'locked']);
        if ($request->has('date')) {
            $q->whereDate('closed_at', $request->date);
        }
        return OrderResource::collection($q->latest('closed_at')->paginate(50));
    }

    public function show(Order $order): OrderResource
    {
        $order->load(['table.zone', 'user', 'items.modifications', 'items.dish', 'items.pizza', 'items.wine', 'sends.printJobs']);
        return new OrderResource($order);
    }

    public function store(StoreOrderRequest $request): JsonResponse
    {
        $table = Table::findOrFail($request->table_id);

        if (Order::where('table_id', $table->id)->where('status', 'open')->exists()) {
            return response()->json(['message' => 'Il tavolo ha già un ordine aperto'], 422);
        }

        $order = DB::transaction(function () use ($request, $table) {
            // Sequence atomica: lockForUpdate su una riga specifica garantisce
            // che due transazioni concorrenti non leggano mai lo stesso valore.
            $seq = DB::table('sequences')
                ->where('name', 'order_number')
                ->lockForUpdate()
                ->first();

            $orderNumber = $seq->value + 1;

            DB::table('sequences')
                ->where('name', 'order_number')
                ->update(['value' => $orderNumber]);

            $order = Order::create([
                'table_id'      => $table->id,
                'user_id'       => auth()->id(),
                'covers'        => 0,
                'coperto_price' => (float) SystemSetting::get('coperto_price', '0'),
                'order_number'  => $orderNumber,
                'status'        => 'open',
            ]);

            $table->update(['status' => 'occupato']);
            return $order;
        });

        // Broadcast dopo commit: i listener leggono lo stato già persistito
        broadcast(new TableStatusChanged($table->fresh()));

        $this->logActivity('ORDER_CREATED',
            "Ordine #{$order->order_number} aperto al tavolo {$table->number} ({$table->zone->name})",
            $order
        );

        return response()->json(new OrderResource($order->load('table.zone')), 201);
    }

    public function destroy(Order $order): JsonResponse
    {
        if ($order->status === 'locked') {
            return response()->json(['message' => 'Ordine bloccato — non modificabile'], 422);
        }
        if ($order->items()->where('status', 'sent')->exists()) {
            return response()->json(['message' => 'Impossibile eliminare ordine già inviato'], 422);
        }
        $table = $order->table;
        $order->delete();
        $table->update(['status' => 'libero']);
        broadcast(new TableStatusChanged($table->fresh()));
        return response()->json(null, 204);
    }

    public function close(Request $request, Order $order): JsonResponse
    {
        if ($order->status === 'locked') {
            return response()->json(['message' => 'Ordine bloccato — non modificabile'], 422);
        }

        if ($order->payments()->exists() && !$order->isFullySettled()) {
            return response()->json(['message' => 'Il conto non è ancora completamente saldato'], 422);
        }

        // M7: avviso bloccante se ci sono stampe fallite. La chiusura elimina i
        // PDF di backup (unica traccia di ciò che non è uscito fisicamente):
        // l'operatore deve confermare esplicitamente (confirm_failed_prints).
        if (! $request->boolean('confirm_failed_prints')) {
            $failed = $order->printJobs()->where('status', 'failed')->count();
            if ($failed > 0) {
                return response()->json([
                    'message'      => "Ci sono {$failed} stampe non riuscite: chiudendo il tavolo i relativi PDF di backup verranno eliminati. Verifica di aver consegnato le comande prima di continuare.",
                    'error_code'   => 'failed_prints_pending',
                    'failed_count' => $failed,
                ], 409);
            }
        }

        DB::transaction(function () use ($order) {
            $order->forceClose();
        });

        // Broadcast dopo commit
        broadcast(new TableStatusChanged($order->table->fresh()));

        // I monitor KDS rifanno il fetch della coda (ora già ripulita dall'ordine chiuso)
        broadcast(new \App\Events\KdsStatusChanged(
            department: 'all',
            eventType:  'order_update',
            payload:    ['order_id' => $order->id]
        ));

        $this->logActivity('TABLE_CLOSED',
            "Tavolo {$order->table->number} ({$order->table->zone->name}) chiuso — ordine #{$order->order_number}",
            $order
        );

        return response()->json(null, 204);
    }

    public function printJobs(Order $order): AnonymousResourceCollection
    {
        return PrintJobResource::collection($order->printJobs()->latest('created_at')->get());
    }

    /**
     * GET /api/v1/orders/{order}/kds-status
     *
     * Indica se l'ordine ha ancora uscite in preparazione o in attesa nei monitor
     * KDS. Usato dalle modali di chiusura (cameriere e cassa) per avvisare prima
     * di chiudere il tavolo. Non bloccante.
     */
    public function kdsStatus(Order $order): JsonResponse
    {
        $uscite = $order->kdsStatuses()
            ->whereIn('status', ['pending', 'in_corso'])
            ->get(['uscita', 'department', 'status']);

        return response()->json([
            'in_preparazione' => $uscite->isNotEmpty(),
            'count'           => $uscite->count(),
            'uscite'          => $uscite,
        ]);
    }

    public function preConto(Order $order): JsonResponse
    {
        if ($order->status !== 'open') {
            $msg = $order->status === 'locked' ? 'Ordine bloccato' : 'Ordine chiuso';
            return response()->json(['message' => $msg], 422);
        }

        // Associa il pre-conto all'invio più recente (FK obbligatoria)
        $lastSendId = $order->sends()
            ->where('send_number', '>', 0)
            ->latest('send_number')
            ->value('id');

        $printer = Printer::where('department', 'cassiere')
            ->where('is_active', true)
            ->first();

        $job = PrintJob::create([
            'order_id'      => $order->id,
            'order_send_id' => $lastSendId,
            'printer_id'    => $printer?->id,
            'print_type'    => 'pre_conto',
            'status'        => 'pending',
            'attempts'      => 0,
            'is_reprint'    => false,
        ]);

        ProcessPrintJob::dispatch($job->id)->onQueue('printing');

        $this->logActivity('PRE_CONTO_PRINTED',
            "Pre-conto ordine #{$order->order_number} inviato alla cassa",
            $order
        );

        return response()->json([
            'job_id' => $job->id,
            'status' => 'pending',
        ]);
    }

    public function preContoPdf(Order $order): Response
    {
        if ($order->status === 'closed') {
            return response()->json(['message' => 'Ordine chiuso'], 422);
        }

        $pdfContent = PdfBackupGenerator::generateOnDemand($order);

        $this->logActivity('PRE_CONTO_PDF_VIEWED',
            "PDF pre-conto ordine #{$order->order_number} visualizzato",
            $order
        );

        return response($pdfContent, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"pre_conto_ordine_{$order->order_number}.pdf\"",
        ]);
    }
}
