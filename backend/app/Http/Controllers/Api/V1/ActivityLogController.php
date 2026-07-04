<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ActivityLogController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = ActivityLog::with('user');

        // filled() (non has()): i valori vuoti inviati dal frontend non devono filtrare
        if ($request->filled('user_id'))     $q->where('user_id', $request->user_id);
        if ($request->filled('action'))      $q->where('action', $request->action);
        if ($request->filled('entity_type')) $q->where('entity_type', $request->entity_type);
        if ($request->filled('from'))        $q->where('created_at', '>=', $request->from . ' 00:00:00');
        if ($request->filled('to'))          $q->where('created_at', '<=', $request->to . ' 23:59:59');

        return ActivityLogResource::collection(
            $q->latest('created_at')->paginate(50)
        );
    }

    /**
     * Elenco dei codici azione effettivamente presenti, per popolare il filtro a tendina.
     */
    public function actions(): JsonResponse
    {
        return response()->json(
            ActivityLog::distinct()->orderBy('action')->pluck('action')
        );
    }

    public function show(ActivityLog $log): ActivityLogResource
    {
        $log->load('user');
        return new ActivityLogResource($log);
    }

    /**
     * Anteprima: quanti log verrebbero eliminati con il cutoff indicato (per la conferma in UI).
     */
    public function countBefore(Request $request): JsonResponse
    {
        $request->validate(['before' => 'required|date']);

        $cutoff = \Carbon\Carbon::parse($request->before)->startOfDay();

        return response()->json([
            'count' => ActivityLog::where('created_at', '<', $cutoff)->count(),
        ]);
    }

    /**
     * Pulizia manuale: elimina i log precedenti alla data indicata (audit bounded, non per-riga).
     * L'operazione stessa viene registrata DOPO la cancellazione, così resta come traccia.
     */
    public function purge(Request $request): JsonResponse
    {
        $request->validate(['before' => 'required|date']);

        $cutoff = \Carbon\Carbon::parse($request->before)->startOfDay();

        $count = ActivityLog::where('created_at', '<', $cutoff)->count();
        ActivityLog::where('created_at', '<', $cutoff)->delete();

        $this->logActivity('ACTIVITY_LOGS_PURGED',
            "Eliminati {$count} log attività precedenti al {$cutoff->format('d/m/Y')}"
        );

        return response()->json(['deleted' => $count]);
    }
}
