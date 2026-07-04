<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PrintJobResource;
use App\Jobs\ProcessPrintJob;
use App\Models\PrintJob;
use App\Services\PrintDispatcher;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PrintController extends Controller
{
    use LogsActivity;

    public function __construct(private PrintDispatcher $printDispatcher) {}

    public function index(): AnonymousResourceCollection
    {
        $jobs = PrintJob::with(['order', 'printer'])
            ->latest('created_at')
            ->paginate(50);
        return PrintJobResource::collection($jobs);
    }

    public function show(PrintJob $job): PrintJobResource
    {
        $job->load(['order', 'printer', 'orderSend']);
        return new PrintJobResource($job);
    }

    public function retry(PrintJob $job): JsonResponse
    {
        if ($job->status === 'done') {
            return response()->json(['message' => 'Job già completato'], 422);
        }
        $job->update(['status' => 'pending', 'attempts' => 0]);
        ProcessPrintJob::dispatch($job->id)->onQueue('printing');
        $this->logActivity('PRINT_RETRY', "Retry print job #{$job->id} ({$job->print_type})", $job->order);
        return response()->json(new PrintJobResource($job->fresh()));
    }

    public function reprint(PrintJob $job): JsonResponse
    {
        $newJob = $this->printDispatcher->reprint($job);
        $this->logActivity('PRINT_REPRINT', "Ristampa print job #{$job->id} ({$job->print_type})", $job->order);
        return response()->json(new PrintJobResource($newJob), 201);
    }

    public function pending(): AnonymousResourceCollection
    {
        return PrintJobResource::collection(
            PrintJob::pending()->with(['order', 'printer'])->latest('created_at')->get()
        );
    }

    public function failed(): AnonymousResourceCollection
    {
        return PrintJobResource::collection(
            PrintJob::failed()->with(['order', 'printer'])->latest('created_at')->get()
        );
    }

    public function destroyFailed(): JsonResponse
    {
        $jobs = PrintJob::failed()->get();

        foreach ($jobs as $job) {
            if ($job->pdf_backup_path && Storage::exists($job->pdf_backup_path)) {
                Storage::delete($job->pdf_backup_path);
            }
        }

        $count = $jobs->count();
        PrintJob::failed()->delete();

        // Pulisce anche la coda Laravel: i job di stampa che hanno esaurito i
        // tentativi restano in `failed_jobs` e non vengono toccati dalla cancellazione
        // dei record `print_jobs`. Senza questo, le stampe fallite "ricompaiono".
        $queueCleared = DB::table('failed_jobs')
            ->where('payload', 'like', '%ProcessPrintJob%')
            ->delete();

        $this->logActivity('PRINT_JOBS_CLEARED', "Eliminate {$count} stampe fallite ({$queueCleared} in coda)");

        return response()->json(['deleted' => $count, 'queue_cleared' => $queueCleared]);
    }
}
