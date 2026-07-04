<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessPrintJob;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ReportController extends Controller
{
    public function __construct(private ReportService $reportService) {}

    public function daily(Request $request): JsonResponse
    {
        $date = $request->get('date', today()->toDateString());
        return response()->json($this->reportService->daily($date));
    }

    public function dishes(Request $request): JsonResponse
    {
        $request->validate([
            'from'        => 'required|date',
            'to'          => 'required|date|after_or_equal:from',
            'category_id' => 'nullable|exists:categories,id',
        ]);
        return response()->json($this->reportService->dishes(
            $request->from, $request->to, $request->category_id
        ));
    }

    public function wines(Request $request): JsonResponse
    {
        $request->validate([
            'from'        => 'required|date',
            'to'          => 'required|date|after_or_equal:from',
            'category_id' => 'nullable|exists:categories,id',
        ]);
        return response()->json($this->reportService->wines(
            $request->from, $request->to, $request->category_id
        ));
    }

    public function pizzaToppings(Request $request): JsonResponse
    {
        $request->validate(['from' => 'required|date', 'to' => 'required|date']);
        return response()->json($this->reportService->pizzaToppings($request->from, $request->to));
    }

    public function covers(Request $request): JsonResponse
    {
        $request->validate(['from' => 'required|date', 'to' => 'required|date']);
        return response()->json($this->reportService->covers($request->from, $request->to));
    }

    public function hourly(Request $request): JsonResponse
    {
        $date = $request->get('date', today()->toDateString());
        return response()->json($this->reportService->hourly($date));
    }

    public function spendPerCover(Request $request): JsonResponse
    {
        $request->validate(['from' => 'required|date', 'to' => 'required|date']);
        return response()->json($this->reportService->spendPerCover($request->from, $request->to));
    }

    public function weekly(Request $request): JsonResponse
    {
        $request->validate(['from' => 'required|date', 'to' => 'required|date']);
        return response()->json($this->reportService->weekly($request->from, $request->to));
    }

    public function monthly(Request $request): JsonResponse
    {
        $year = (int) $request->get('year', now()->year);
        return response()->json($this->reportService->monthly($year));
    }

    public function waiters(Request $request): JsonResponse
    {
        $request->validate(['from' => 'required|date', 'to' => 'required|date']);
        return response()->json($this->reportService->waiters($request->from, $request->to));
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $request->validate([
            'type' => 'required|in:daily,dishes,covers,hourly,weekly,monthly,waiters',
            'date' => 'nullable|date',
            'from' => 'nullable|date',
            'to'   => 'nullable|date',
        ]);

        try {
            $type = $request->type;
            $date = $request->get('date', today()->toDateString());
            $from = $request->from;
            $to   = $request->to;

            $payload = match ($type) {
                'daily'   => $this->reportService->daily($date),
                'dishes'  => ['from' => $from, 'to' => $to, 'rows' => $this->reportService->dishes($from, $to)->toArray()],
                'covers'  => ['from' => $from, 'to' => $to, 'rows' => $this->reportService->covers($from, $to)->toArray()],
                'hourly'  => ['date' => $date, 'rows' => $this->reportService->hourly($date)->toArray()],
                'weekly'  => ['from' => $from, 'to' => $to, 'rows' => $this->reportService->weekly($from, $to)->toArray()],
                'monthly' => ['year' => now()->year, 'rows' => $this->reportService->monthly((int) now()->year)->toArray()],
                'waiters' => ['from' => $from, 'to' => $to, 'rows' => $this->reportService->waiters($from, $to)->toArray()],
            };

            $path = $this->reportService->generatePdf($type, $payload);

            return response()->download(Storage::path($path), basename($path), [
                'Content-Type' => 'application/pdf',
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Errore nella generazione del PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Stampa il report corrente sulla stampante termica della cassa (reparto 'cassiere').
     * Il payload ESC/POS viene generato in coda a partire dai metadati del job.
     */
    public function printThermal(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'required|in:daily,weekly,dishes,waiters,hourly',
            'date' => 'nullable|date',
            'from' => 'nullable|date',
            'to'   => 'nullable|date|after_or_equal:from',
        ]);

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
                'report_type' => $request->type,
                'report_date' => $request->get('date', today()->toDateString()),
                'report_from' => $request->from,
                'report_to'   => $request->to,
            ],
        ]);

        ProcessPrintJob::dispatch($job->id)->onQueue('printing');

        return response()->json(['success' => true, 'job_id' => $job->id]);
    }
}
