<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ServiceSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceScheduleController extends Controller
{
    public function index(): JsonResponse
    {
        $schedule = ServiceSchedule::all()->groupBy('department')->map(fn($rows) =>
            $rows->pluck('is_active', 'day_of_week')
        );
        return response()->json($schedule);
    }

    public function today(): JsonResponse
    {
        // 0=Lun, 6=Dom; PHP: 0=Dom, 1=Lun → adattiamo
        $phpDow = (int) now()->format('w'); // 0=Sun
        $dow    = $phpDow === 0 ? 6 : $phpDow - 1; // converti a 0=Lun

        $rows = ServiceSchedule::where('day_of_week', $dow)->get();

        return response()->json([
            'day_of_week' => $dow,
            'departments' => $rows->mapWithKeys(fn($r) => [$r->department => $r->is_active]),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            '*.department'  => 'required|in:cucina,pizzeria,bar',
            '*.day_of_week' => 'required|integer|min:0|max:6',
            '*.is_active'   => 'required|boolean',
        ]);

        foreach ($request->all() as $row) {
            ServiceSchedule::updateOrCreate(
                ['department' => $row['department'], 'day_of_week' => $row['day_of_week']],
                ['is_active'  => $row['is_active']]
            );
        }

        return response()->json(['message' => 'Schedule aggiornato']);
    }
}
