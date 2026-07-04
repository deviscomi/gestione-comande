<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePrinterRequest;
use App\Http\Resources\PrinterResource;
use App\Models\Printer;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PrinterController extends Controller
{
    use LogsActivity;

    public function index(): AnonymousResourceCollection
    {
        return PrinterResource::collection(Printer::orderBy('department')->get());
    }

    public function show(Printer $printer): PrinterResource
    {
        return new PrinterResource($printer);
    }

    public function store(StorePrinterRequest $request): JsonResponse
    {
        $printer = Printer::create($request->validated());
        $this->logActivity('PRINTER_CREATED', "Stampante '{$printer->name}' ({$printer->department}) aggiunta", $printer);
        return response()->json(new PrinterResource($printer), 201);
    }

    public function update(StorePrinterRequest $request, Printer $printer): PrinterResource
    {
        $printer->update($request->validated());
        $this->logActivity('PRINTER_UPDATED', "Stampante '{$printer->name}' aggiornata", $printer);
        return new PrinterResource($printer->fresh());
    }

    public function destroy(Printer $printer): JsonResponse
    {
        $this->logActivity('PRINTER_DELETED', "Stampante '{$printer->name}' eliminata", $printer);
        $printer->delete();
        return response()->json(null, 204);
    }

    public function toggle(Printer $printer): PrinterResource
    {
        $printer->update(['is_active' => !$printer->is_active]);
        return new PrinterResource($printer);
    }

    public function test(Printer $printer): JsonResponse
    {
        $socket = @fsockopen($printer->ip_address, $printer->port, $errno, $errstr, 3);

        if (!$socket) {
            return response()->json([
                'success' => false,
                'message' => "Stampante non raggiungibile: {$errstr} (errno {$errno})",
            ], 503);
        }

        $payload = "\x1B@"           // reset
            . "\x1Ba\x01"            // center
            . "\x1BE\x01"            // bold on
            . "TEST STAMPA\n"
            . "\x1BE\x00"            // bold off
            . "Gestione Comande\n"
            . "Stampante: {$printer->name}\n"
            . "Reparto: {$printer->department}\n"
            . now()->format('d/m/Y H:i:s') . "\n"
            . "--------------------------------\n\n"
            . "\x1DV\x42\x00";       // cut

        fwrite($socket, $payload);
        fclose($socket);

        $this->logActivity('PRINTER_TEST', "Test stampa '{$printer->name}' eseguito", $printer);
        return response()->json(['success' => true, 'message' => 'Test stampa inviato']);
    }
}
