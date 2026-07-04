<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ZoneResource;
use App\Models\Order;
use App\Models\PrintJob;
use App\Models\Table;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'zones'          => ZoneResource::collection(
                Zone::with(['tables' => fn($q) => $q->with('activeOrder')->orderBy('number')])
                    ->enabled()
                    ->orderBy('sort_order')
                    ->get()
            ),
            'open_tables'    => Table::whereIn('status', ['occupato', 'in_corso'])->count(),
            'total_covers'   => Order::where('status', 'open')->sum('covers'),
            'today_revenue'  => (float) Order::whereDate('closed_at', today())
                ->whereIn('status', ['closed', 'locked'])
                ->sum('total'),
            'pending_prints' => PrintJob::where('status', 'pending')->count(),
            'failed_prints'  => PrintJob::where('status', 'failed')->count(),
        ]);
    }

    public function summary(): JsonResponse
    {
        $openOrders = Order::with(['table.zone', 'user'])
            ->where('status', 'open')
            ->get();

        return response()->json([
            'open_orders'   => $openOrders->count(),
            'total_pending' => $openOrders->sum('total'),
            'covers_now'    => $openOrders->sum('covers'),
            'today_closed'  => Order::whereDate('closed_at', today())
                ->whereIn('status', ['closed', 'locked'])
                ->count(),
            'today_revenue' => (float) Order::whereDate('closed_at', today())
                ->whereIn('status', ['closed', 'locked'])
                ->sum('total'),
        ]);
    }
}
