<?php

namespace App\Services;

use App\Models\DailyClosure;
use App\Models\Order;
use App\Models\OrderItem;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class ReportService
{
    public function daily(string $date): array
    {
        $orders = Order::whereDate('closed_at', $date)
            ->whereIn('status', ['closed', 'locked']);

        return [
            'date'         => $date,
            'total'        => (float) $orders->sum('total'),
            'orders_count' => $orders->count(),
            'covers'       => (int) $orders->sum('covers'),
        ];
    }

    public function dishes(string $from, string $to, ?int $categoryId = null): Collection
    {
        return OrderItem::with('dish.category')
            ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->where('item_type', 'dish')
            ->where('status', '!=', 'cancelled')
            ->when($categoryId, fn($q) => $q->whereHas('dish', fn($q) => $q->where('category_id', $categoryId)))
            ->selectRaw('dish_id, SUM(quantity) as total_qty, SUM(total_price) as total_revenue')
            ->groupBy('dish_id')
            ->orderByDesc('total_qty')
            ->limit(20)
            ->get();
    }

    public function wines(string $from, string $to, ?int $categoryId = null): Collection
    {
        return OrderItem::with('wine.category')
            ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->where('item_type', 'wine')
            ->where('status', '!=', 'cancelled')
            ->when($categoryId, fn($q) => $q->whereHas('wine', fn($q) => $q->where('category_id', $categoryId)))
            ->selectRaw('wine_id, SUM(quantity) as total_qty, SUM(total_price) as total_revenue')
            ->groupBy('wine_id')
            ->orderByDesc('total_qty')
            ->limit(20)
            ->get();
    }

    public function pizzaToppings(string $from, string $to): Collection
    {
        return \App\Models\OrderItemMod::whereHas('orderItem', fn($q) =>
            $q->where('item_type', 'pizza')
              ->where('status', '!=', 'cancelled')
              ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
        )
        ->selectRaw('mod_type, mod_value, COUNT(*) as count')
        ->groupBy('mod_type', 'mod_value')
        ->orderByDesc('count')
        ->get();
    }

    public function covers(string $from, string $to): Collection
    {
        return Order::whereBetween('closed_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereIn('status', ['closed', 'locked'])
            ->selectRaw('DATE(closed_at) as date, SUM(covers) as total_covers, COUNT(*) as orders_count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();
    }

    public function hourly(string $date): Collection
    {
        return Order::whereDate('first_sent_at', $date)
            ->whereIn('status', ['closed', 'locked', 'open'])
            ->selectRaw('HOUR(first_sent_at) as hour, SUM(total) as revenue, COUNT(*) as orders, SUM(covers) as covers')
            ->groupBy('hour')
            ->orderBy('hour')
            ->get();
    }

    public function spendPerCover(string $from, string $to): Collection
    {
        return Order::whereBetween('closed_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereIn('status', ['closed', 'locked'])
            ->where('covers', '>', 0)
            ->selectRaw('DATE(closed_at) as date, AVG(total / covers) as avg_spend_per_cover, SUM(total) as total_revenue, SUM(covers) as total_covers')
            ->groupBy('date')
            ->orderBy('date')
            ->get();
    }

    public function weekly(string $from, string $to): Collection
    {
        return Order::whereBetween('closed_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereIn('status', ['closed', 'locked'])
            ->selectRaw('YEARWEEK(closed_at, 1) as week, MIN(DATE(closed_at)) as week_start, SUM(total) as revenue, COUNT(*) as orders, SUM(covers) as covers')
            ->groupBy('week')
            ->orderBy('week')
            ->get();
    }

    public function monthly(int $year): Collection
    {
        return Order::whereYear('closed_at', $year)
            ->whereIn('status', ['closed', 'locked'])
            ->selectRaw('MONTH(closed_at) as month, SUM(total) as revenue, COUNT(*) as orders, SUM(covers) as covers')
            ->groupBy('month')
            ->orderBy('month')
            ->get();
    }

    public function waiters(string $from, string $to): Collection
    {
        return Order::with('user')
            ->whereBetween('closed_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereIn('status', ['closed', 'locked'])
            ->selectRaw('user_id, COUNT(*) as tables_served, SUM(covers) as total_covers, SUM(total) as revenue')
            ->groupBy('user_id')
            ->get();
    }

    public function generatePdf(string $type, array $data): string
    {
        $view = view()->exists("reports.{$type}") ? "reports.{$type}" : 'reports.generic';

        $html = view($view, ['data' => $data, 'type' => $type])->render();
        $pdf  = Pdf::loadHTML($html)->setPaper('a4');

        $stamp = $data['date'] ?? $data['from'] ?? now()->format('Ymd_His');
        $path  = "reports/{$type}_{$stamp}.pdf";

        Storage::put($path, $pdf->output());

        return $path;
    }
}
