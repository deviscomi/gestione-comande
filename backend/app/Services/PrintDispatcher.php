<?php

namespace App\Services;

use App\Jobs\ProcessPrintJob;
use App\Models\Order;
use App\Models\OrderSend;
use App\Models\PrintJob;
use App\Models\Printer;
use Illuminate\Support\Collection;

class PrintDispatcher
{
    public const BAR_DEPARTMENTS = ['bevande', 'dessert', 'amari', 'vini_casa', 'carta_vini'];

    public function dispatch(Order $order, OrderSend $send, Collection $items): Collection
    {
        $printTypes = $this->determinePrintTypes($order, $send, $items);
        $jobs = collect();

        $printers = Printer::where('is_active', true)
            ->whereIn('department', $printTypes)
            ->get()
            ->keyBy('department');

        $agentMode = config('printing.driver') === 'agent';

        foreach ($printTypes as $type) {
            $job = PrintJob::create([
                'order_id'      => $order->id,
                'order_send_id' => $send->id,
                'printer_id'    => $printers->get($type)?->id,
                'print_type'    => $type,
                'status'        => 'pending',
                'attempts'      => 0,
                'is_reprint'    => false,
            ]);

            // Modalità 'agent': il job (pending) resta in coda per il Raspberry.
            // Modalità 'socket': il worker apre subito il socket verso la stampante.
            if (! $agentMode) {
                ProcessPrintJob::dispatch($job->id)->onQueue('printing');
            }
            $jobs->push($job->fresh());
        }

        return $jobs;
    }

    public function reprint(PrintJob $source): PrintJob
    {
        $newJob = PrintJob::create([
            'order_id'      => $source->order_id,
            'order_send_id' => $source->order_send_id,
            'printer_id'    => $source->printer_id,
            'print_type'    => $source->print_type,
            'status'        => 'pending',
            'attempts'      => 0,
            'is_reprint'    => true,
        ]);

        if (config('printing.driver') !== 'agent') {
            ProcessPrintJob::dispatch($newJob->id)->onQueue('printing');
        }
        return $newJob;
    }

    private function determinePrintTypes(Order $order, OrderSend $send, Collection $items): array
    {
        $isFirstSend = $send->send_number === 1;

        if ($isFirstSend) {
            $departments = self::classifyItems($items);
            $types = ['cassiere'];
            if (in_array('cucina', $departments)) {
                $types[] = 'cucina';
            }
            if ($items->where('item_type', 'pizza')->isNotEmpty()) {
                $types[] = 'pizzeria';
            }
            if (in_array('bar', $departments)) {
                $types[] = 'bar';
            }
            return $types;
        }

        // Invii successivi — mappa esatta della matrice DRF.md §3
        $departments    = self::classifyItems($items);
        $hasPizzas      = in_array('pizzeria', $departments);
        $hasKitchenFood = in_array('cucina', $departments);
        $hasBarItems    = in_array('bar', $departments);

        $types = ['cassiere']; // cassiere sempre su ogni invio

        if ($hasPizzas) {
            // Pizze (con o senza altro) → cassiere + cucina + pizzeria
            $types[] = 'cucina';
            $types[] = 'pizzeria';
        } elseif ($hasKitchenFood) {
            // Cucina (no pizze): antipasti/primi/secondi/contorni
            $types[] = 'cucina';
            // Pizzeria con segnale CUCINA se nell'ordine ci sono già pizze inviate
            $hasPreviousPizzas = $order->items()
                ->where('item_type', 'pizza')
                ->where('status', 'sent')
                ->where('order_send_id', '!=', $send->id)
                ->exists();
            if ($hasPreviousPizzas) {
                $types[] = 'pizzeria';
            }
        }

        if ($hasBarItems) {
            $types[] = 'bar';
        }

        return $types;
    }

    /**
     * Raggruppa gli articoli per uscita, poi per categoria all'interno di ogni uscita.
     * Restituisce una Collection ordinata per uscita ASC.
     *
     * Struttura risultante:
     *   [ uscita => [ 'NomeCategoria' => Collection<OrderItem>, 'pizze' => Collection ] ]
     */
    public static function groupByUscita(Collection $items): Collection
    {
        return $items
            ->sortBy('uscita')
            ->groupBy('uscita')
            ->map(function ($uscitaItems) {
                return $uscitaItems->sortBy('sort_order')->groupBy(function ($item) {
                    if ($item->item_type === 'pizza') return 'pizze';
                    if ($item->item_type === 'wine') return $item->wine?->category?->name ?? 'Vini';
                    return $item->dish?->category?->name ?? 'Altro';
                });
            });
    }

    /**
     * Verifica se un gruppo di articoli (di una singola uscita) contiene
     * piatti di cucina (non pizze). Le bevande/dessert/amari sono dish con
     * category.department nei BAR_DEPARTMENTS e NON contano come cucina.
     */
    public static function uscitaHasCucina(Collection $uscitaItems): bool
    {
        return $uscitaItems->flatten(1)->contains(function ($item) {
            if ($item->item_type !== 'dish') {
                return false;
            }
            $dept = $item->dish?->category?->department ?? 'cucina';
            return ! in_array($dept, self::BAR_DEPARTMENTS, true);
        });
    }

    public static function classifyItems(Collection $items): array
    {
        $departments = [];
        foreach ($items as $item) {
            if ($item->item_type === 'pizza') {
                $departments[] = 'pizzeria';
            } elseif ($item->item_type === 'wine') {
                $departments[] = 'bar';
            } else {
                $catDept = $item->dish?->category?->department ?? 'cucina';
                $departments[] = in_array($catDept, self::BAR_DEPARTMENTS) ? 'bar' : $catDept;
            }
        }
        return array_unique($departments);
    }
}
