<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\FiscalReceiptListResource;
use App\Http\Resources\FiscalReceiptResource;
use App\Jobs\EmitFiscalReceiptJob;
use App\Models\FiscalReceipt;
use App\Models\OrderPayment;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FiscalReceiptController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = FiscalReceipt::with([
            'orderPayment.order.table.zone',
            'orderPayment.user',
            'fiscalDevice',
        ]);

        if ($request->filled('fiscal_status')) $q->where('fiscal_status', $request->fiscal_status);
        if ($request->filled('from'))          $q->where('created_at', '>=', $request->from . ' 00:00:00');
        if ($request->filled('to'))            $q->where('created_at', '<=', $request->to . ' 23:59:59');

        return FiscalReceiptListResource::collection(
            $q->latest('created_at')->paginate(50)
        );
    }

    public function show(OrderPayment $payment): JsonResponse
    {
        $receipt = $payment->fiscalReceipt;

        if (! $receipt) {
            return response()->json(['message' => 'Nessun scontrino fiscale per questo pagamento'], 404);
        }

        return response()->json(new FiscalReceiptResource($receipt));
    }

    public function emit(OrderPayment $payment): JsonResponse
    {
        EmitFiscalReceiptJob::dispatchSync($payment->id);

        return response()->json(new FiscalReceiptResource($payment->fiscalReceipt()->first()));
    }

    public function retry(OrderPayment $payment): JsonResponse
    {
        EmitFiscalReceiptJob::dispatchSync($payment->id);

        return response()->json(new FiscalReceiptResource($payment->fiscalReceipt()->first()));
    }

    public function skip(Request $request, OrderPayment $payment): JsonResponse
    {
        $request->validate(['note' => 'required|string|min:3']);

        $receipt = $payment->fiscalReceipt;

        if (! $receipt) {
            return response()->json(['message' => 'Nessun scontrino fiscale da annullare per questo pagamento'], 404);
        }

        $receipt->update([
            'fiscal_status'        => 'voided',
            'fiscal_error_message' => $request->note,
        ]);

        $this->logActivity('FISCAL_RECEIPT_SKIPPED',
            "Procede senza scontrino fiscale per il pagamento #{$payment->id}: {$request->note}",
            $receipt
        );

        return response()->json(new FiscalReceiptResource($receipt->fresh()));
    }
}
