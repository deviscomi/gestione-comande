<?php

namespace App\Services;

use App\Models\PrintJob;
use Illuminate\Support\Collection;

class EscPosRenderer
{
    // ── Costanti ESC/POS ────────────────────────────────────────────────────
    const ESC = "\x1B";
    const GS  = "\x1D";

    const RESET       = "\x1B@";
    const CENTER      = "\x1Ba\x01";
    const LEFT        = "\x1Ba\x00";
    const BOLD_ON     = "\x1BE\x01";
    const BOLD_OFF    = "\x1BE\x00";
    const FONT_NORMAL = "\x1D!\x00";
    const FONT_DOUBLE = "\x1D!\x11";
    const FONT_LARGE  = "\x1D!\x30";
    const CUT         = "\x1DV\x42\x00";
    const LF          = "\n";

    // Larghezza di stampa: si usa l'intera larghezza della carta da 80mm.
    // In Font A una testina da 80mm (~576 dot) stampa 48 colonne. Nessun
    // margine hardware (GS L / GS W) viene applicato: quei comandi davano
    // rientri incoerenti/alternati tra stampe consecutive perché il registro
    // margine del firmware non si reinizializzava in modo affidabile.
    // Se i divisori dovessero andare a capo su due righe, la testina ha meno
    // di 48 colonne: ridurre solo questa costante (47, 46, 42...).
    const LINE_WIDTH = 48;

    // Numero di caratteri Font A normale che entrano nella riga di stampa.
    private static function lineWidth(): int
    {
        return self::LINE_WIDTH;
    }

    private static function divider(): string
    {
        return str_repeat('-', self::lineWidth());
    }

    // Rientri di testo uniformi su tutte le stampe:
    // - WRAP_INDENT: continuazione a capo di una riga primaria (es. nome
    //   piatto/pizza troppo lungo) — solo le righe successive alla prima
    //   sono rientrate, per segnalare che stanno "continuando" la riga sopra.
    // - NOTE_INDENT: blocco di dettaglio secondario nidificato sotto una riga
    //   primaria (modifiche, NOTE, "con Variante") — rientrato fin dalla
    //   prima riga, per distinguerlo visivamente come subordinato.
    const WRAP_INDENT = '  ';
    const NOTE_INDENT = '    ';

    // Wrappa un blocco di testo nidificato (dettaglio/nota) rientrandolo
    // uniformemente su tutte le righe, inclusa la prima.
    private static function wrapNested(string $text, string $indent = self::NOTE_INDENT): string
    {
        return self::wrapText($indent . $text, self::lineWidth(), $indent);
    }

    public static function render(PrintJob $job): string
    {
        return match ($job->print_type) {
            'cassiere'  => self::renderCassiere($job),
            'cucina'    => self::renderCucina($job),
            'bar'       => self::renderBar($job),
            'pizzeria'  => self::renderPizzeria($job),
            'pre_conto'           => self::renderPreConto($job),
            'scontrino_parziale'  => self::renderScontrinoParziale($job),
            'report_thermal'      => self::renderReportThermal($job),
            default               => '',
        };
    }

    // Etichetta italiana per gli invii successivi al primo: 2°→BIS, 3°→TRIS, poi ordinali numerici.
    private static function aggiuntaLabel(int $sendNumber): string
    {
        return match ($sendNumber) {
            2 => 'BIS',
            3 => 'TRIS',
            default => "{$sendNumber}°",
        };
    }

    // Etichetta tavolo completa, incluso suffisso bis/tris se presente.
    private static function tableLabel($table): string
    {
        $suffix = $table->suffix ? ' ' . ucfirst($table->suffix) : '';
        return "Tav {$table->number}{$suffix} [{$table->zone->name}]";
    }

    // Costruisce la stringa comma-separated di modifiche + note per un articolo.
    private static function buildItemDetail($item): string
    {
        $parts = [];
        foreach ($item->modifications as $mod) {
            $parts[] = self::formatMod($mod);
        }
        if ($item->notes) {
            $parts[] = "NOTE: {$item->notes}";
        }
        return implode(', ', $parts);
    }

    // ── CASSIERE ────────────────────────────────────────────────────────────
    private static function renderCassiere(PrintJob $job): string
    {
        $order = $job->order;
        $out   = '';

        $out .= self::RESET;
        $out .= self::CENTER;
        $out .= self::FONT_DOUBLE . self::tableLabel($order->table) . self::LF . self::FONT_NORMAL;
        $out .= self::BOLD_ON . "* CASSA *" . self::BOLD_OFF . self::LF;

        if ($job->is_reprint) {
            $out .= self::BOLD_ON . "*** RISTAMPA ***" . self::BOLD_OFF . self::LF;
        }

        $out .= self::LEFT . self::divider() . self::LF;

        $sentAt = $order->first_sent_at?->format('H:i') ?? now()->format('H:i');
        $out .= "Comanda #" . str_pad($order->order_number, 4, '0', STR_PAD_LEFT);
        $out .= "   Cop: {$order->covers}   {$sentAt}" . self::LF;
        $out .= "Cameriere: {$order->user->name} {$order->user->surname}" . self::LF;
        $out .= self::divider() . self::LF;

        // Tutti gli articoli non annullati, ordinati per uscita poi per sort_order
        $activeItems = $order->items()
            ->with(['dish.category', 'pizza', 'wine.category', 'modifications'])
            ->where('status', '!=', 'cancelled')
            ->orderBy('uscita')
            ->orderBy('sort_order')
            ->get();

        $byUscita = $activeItems->groupBy('uscita');

        foreach ($byUscita as $uscitaNum => $uscitaItems) {
            $out .= self::BOLD_ON . self::FONT_DOUBLE
                  . "USCITA {$uscitaNum}"
                  . self::FONT_NORMAL . self::BOLD_OFF . self::LF;

            $grouped = $uscitaItems->sortBy('sort_order')
                ->groupBy(fn($i) => match ($i->item_type) {
                    'pizza' => 'Pizze',
                    'wine'  => $i->wine?->category?->name ?? 'Vini',
                    default => $i->dish?->category?->name ?? 'Altro',
                });

            foreach ($grouped as $catName => $catItems) {
                $out .= self::BOLD_ON . strtoupper($catName) . self::BOLD_OFF . self::LF;
                foreach ($catItems as $item) {
                    $name  = match ($item->item_type) {
                        'pizza' => $item->pizza?->name,
                        'wine'  => $item->wine?->name,
                        default => $item->dish?->name,
                    };
                    $price  = number_format($item->total_price, 2);
                    $base   = "x{$item->quantity} {$name}";
                    $detail = self::buildItemDetail($item);
                    $line   = $detail !== '' ? "{$base}, {$detail}" : $base;

                    if (mb_strlen($line) <= self::lineWidth() - mb_strlen($price) - 1) {
                        $out .= self::padLine($line, $price, self::lineWidth()) . self::LF;
                    } else {
                        $out .= self::padLine($base, $price, self::lineWidth()) . self::LF;
                        if ($detail !== '') {
                            $out .= self::wrapNested($detail) . self::LF;
                        }
                    }
                }
            }
            $out .= self::LF;
        }

        $out .= self::divider() . self::LF;

        // Riga coperto — visibile solo se coperto_price > 0
        $copertoPrice = (float)($order->coperto_price ?? 0);
        if ($copertoPrice > 0) {
            $copertoTotal = number_format($order->covers * $copertoPrice, 2);
            $copertoLine  = "Coperto x{$order->covers} (EUR " . number_format($copertoPrice, 2) . ")";
            $out .= self::padLine($copertoLine, $copertoTotal, self::lineWidth()) . self::LF;
        }

        $out .= self::LF;

        $total = number_format($order->total, 2);
        $out .= self::BOLD_ON . self::FONT_DOUBLE . "TOTALE EUR {$total}" . self::FONT_NORMAL . self::BOLD_OFF . self::LF;
        $out .= self::LF . self::LF;
        $out .= self::CUT;

        return $out;
    }

    // ── CUCINA ───────────────────────────────────────────────────────────────
    private static function renderCucina(PrintJob $job): string
    {
        $order = $job->order;
        $send  = $job->orderSend;
        $out   = '';

        $out .= self::RESET;
        $out .= self::CENTER;
        $out .= self::FONT_DOUBLE . self::tableLabel($order->table) . self::LF . self::FONT_NORMAL;
        $out .= self::BOLD_ON . "* CUCINA *" . self::BOLD_OFF . self::LF;

        if ($job->is_reprint) {
            $out .= self::BOLD_ON . "*** RISTAMPA ***" . self::BOLD_OFF . self::LF;
        }

        $isFirstSend = $send->send_number === 1;
        if (!$isFirstSend) {
            $out .= self::CENTER . self::BOLD_ON . "--- AGGIUNTA " . self::aggiuntaLabel($send->send_number) . " ---" . self::BOLD_OFF . self::LF;
        }

        $out .= self::LEFT . self::divider() . self::LF;
        $sentAt = $send->sent_at?->format('H:i') ?? now()->format('H:i');
        $out .= "Comanda #" . str_pad($order->order_number, 4, '0', STR_PAD_LEFT);
        $out .= "   Cop: {$order->covers}   {$sentAt}" . self::LF;
        $out .= "Cameriere: {$order->user->name} {$order->user->surname}" . self::LF;
        $out .= self::divider() . self::LF;

        $items = $send->items()
            ->with(['dish.category', 'pizza', 'modifications'])
            ->where('status', 'sent')
            ->where('item_type', '!=', 'wine') // i vini non vanno in cucina, solo nel conto
            ->where(function ($q) {
                // bevande/dessert/amari/vini_casa vanno sulla comanda Bar, non in cucina
                $q->where('item_type', 'pizza')
                  ->orWhereHas('dish.category', fn ($q2) => $q2->whereNotIn('department', PrintDispatcher::BAR_DEPARTMENTS));
            })
            ->orderBy('uscita')
            ->get();

        if ($items->isEmpty()) {
            return '';
        }

        $grouped = PrintDispatcher::groupByUscita($items);

        foreach ($grouped as $uscitaNum => $categorieItems) {
            $hasPizza = $categorieItems->has('pizze');
            $out .= self::BOLD_ON . self::FONT_DOUBLE
                  . "USCITA {$uscitaNum}" . ($hasPizza ? "  [CON PIZZERIA]" : "")
                  . self::FONT_NORMAL . self::BOLD_OFF . self::LF;

            // Pizze sempre in fondo per uscita: lo chef vede prima la cucina,
            // poi sa che in coda trova le pizze (ingredienti freschi condivisi).
            $pizzeItems = $categorieItems->pull('pizze');
            $ordered    = $pizzeItems !== null
                ? $categorieItems->put('pizze', $pizzeItems)
                : $categorieItems;

            foreach ($ordered as $catName => $catItems) {
                $sectionLabel = $catName === 'pizze'
                    ? "--- PIZZE [\xE2\x86\x92 PIZZERIA] ---"
                    : "--- " . strtoupper($catName) . " ---";

                $out .= self::BOLD_ON . $sectionLabel . self::BOLD_OFF . self::LF;

                foreach ($catItems as $item) {
                    $name   = $item->item_type === 'pizza' ? $item->pizza?->name : $item->dish?->name;
                    $base   = "x{$item->quantity} {$name}";
                    $detail = self::buildItemDetail($item);
                    $line   = $detail !== '' ? "{$base}, {$detail}" : $base;

                    if (mb_strlen($line) <= self::lineWidth()) {
                        $out .= self::BOLD_ON . $base . self::BOLD_OFF;
                        if ($detail !== '') $out .= ', ' . $detail;
                        $out .= self::LF;
                    } else {
                        $out .= self::BOLD_ON . self::wrapText($base, self::lineWidth(), self::WRAP_INDENT) . self::BOLD_OFF . self::LF;
                        if ($detail !== '') {
                            $out .= self::wrapNested($detail) . self::LF;
                        }
                    }
                }
            }
            $out .= self::LF;
        }

        $out .= self::LF . self::LF;
        $out .= self::CUT;

        return $out;
    }

    // ── BAR ──────────────────────────────────────────────────────────────────
    private static function renderBar(PrintJob $job): string
    {
        $order = $job->order;
        $send  = $job->orderSend;
        $out   = '';

        $out .= self::RESET;
        $out .= self::CENTER;
        $out .= self::FONT_DOUBLE . self::tableLabel($order->table) . self::LF . self::FONT_NORMAL;
        $out .= self::BOLD_ON . "* BAR *" . self::BOLD_OFF . self::LF;

        if ($job->is_reprint) {
            $out .= self::BOLD_ON . "*** RISTAMPA ***" . self::BOLD_OFF . self::LF;
        }

        $isFirstSend = $send->send_number === 1;
        if (!$isFirstSend) {
            $out .= self::CENTER . self::BOLD_ON . "--- AGGIUNTA " . self::aggiuntaLabel($send->send_number) . " ---" . self::BOLD_OFF . self::LF;
        }

        $out .= self::LEFT . self::divider() . self::LF;
        $sentAt = $send->sent_at?->format('H:i') ?? now()->format('H:i');
        $out .= "Comanda #" . str_pad($order->order_number, 4, '0', STR_PAD_LEFT);
        $out .= "   Cop: {$order->covers}   {$sentAt}" . self::LF;
        $out .= "Cameriere: {$order->user->name} {$order->user->surname}" . self::LF;
        $out .= self::divider() . self::LF;

        $items = $send->items()
            ->with(['dish.category', 'wine.category', 'modifications'])
            ->where('status', 'sent')
            ->where(function ($q) {
                $q->where('item_type', 'wine')
                  ->orWhereHas('dish.category', fn ($q2) => $q2->whereIn('department', PrintDispatcher::BAR_DEPARTMENTS));
            })
            ->orderBy('uscita')
            ->get();

        if ($items->isEmpty()) {
            return '';
        }

        $grouped = PrintDispatcher::groupByUscita($items);

        foreach ($grouped as $uscitaNum => $categorieItems) {
            $out .= self::BOLD_ON . self::FONT_DOUBLE
                  . "USCITA {$uscitaNum}"
                  . self::FONT_NORMAL . self::BOLD_OFF . self::LF;

            foreach ($categorieItems as $catName => $catItems) {
                $out .= self::BOLD_ON . "--- " . strtoupper($catName) . " ---" . self::BOLD_OFF . self::LF;

                foreach ($catItems as $item) {
                    $name   = $item->item_type === 'wine' ? $item->wine?->name : $item->dish?->name;
                    $base   = "x{$item->quantity} {$name}";
                    $detail = self::buildItemDetail($item);
                    $line   = $detail !== '' ? "{$base}, {$detail}" : $base;

                    if (mb_strlen($line) <= self::lineWidth()) {
                        $out .= self::BOLD_ON . $base . self::BOLD_OFF;
                        if ($detail !== '') $out .= ', ' . $detail;
                        $out .= self::LF;
                    } else {
                        $out .= self::BOLD_ON . self::wrapText($base, self::lineWidth(), self::WRAP_INDENT) . self::BOLD_OFF . self::LF;
                        if ($detail !== '') {
                            $out .= self::wrapNested($detail) . self::LF;
                        }
                    }
                }
            }
            $out .= self::LF;
        }

        $out .= self::LF . self::LF;
        $out .= self::CUT;

        return $out;
    }

    // ── PIZZERIA ─────────────────────────────────────────────────────────────
    private static function renderPizzeria(PrintJob $job): string
    {
        $order = $job->order;
        $send  = $job->orderSend;
        $out   = '';

        $out .= self::RESET;
        $out .= self::CENTER;
        $out .= self::FONT_DOUBLE . self::tableLabel($order->table) . self::LF . self::FONT_NORMAL;
        $out .= self::BOLD_ON . "* PIZZERIA *" . self::BOLD_OFF . self::LF;

        if ($job->is_reprint) {
            $out .= self::BOLD_ON . "*** RISTAMPA ***" . self::BOLD_OFF . self::LF;
        }

        if ($send->send_number > 1) {
            $out .= self::BOLD_ON . "--- AGGIUNTA " . self::aggiuntaLabel($send->send_number) . " ---" . self::BOLD_OFF . self::LF;
        }

        // Divider di separazione header/corpo — ancora in CENTER, poi switch a LEFT
        $out .= self::divider() . self::LF;
        $out .= self::LEFT;

        $sentAt = $send->sent_at?->format('H:i') ?? now()->format('H:i');
        $out .= "Comanda #" . str_pad($order->order_number, 4, '0', STR_PAD_LEFT);
        $out .= "   Cop: {$order->covers}   {$sentAt}" . self::LF;
        $out .= "Cameriere: {$order->user->name} {$order->user->surname}" . self::LF;
        $out .= self::divider() . self::LF;

        $allItems = $order->items()
            ->with(['dish.category', 'pizza', 'modifications'])
            ->where('status', 'sent')
            ->orderBy('uscita')
            ->get();

        $byUscita = $allItems->groupBy('uscita');

        foreach ($byUscita as $uscitaNum => $uscitaItems) {
            $pizze  = $uscitaItems->where('item_type', 'pizza');
            // Solo i dish di cucina contano come "CON CUCINA": bevande/dessert/amari
            // sono dish con category.department nei BAR_DEPARTMENTS e non riguardano la cucina.
            $cucina = $uscitaItems->filter(function ($item) {
                if ($item->item_type !== 'dish') {
                    return false;
                }
                $dept = $item->dish?->category?->department ?? 'cucina';
                return ! in_array($dept, PrintDispatcher::BAR_DEPARTMENTS, true);
            });

            if ($pizze->isEmpty()) continue;

            $hasCucina = $cucina->isNotEmpty();
            $signal = $hasCucina
                ? "USCITA {$uscitaNum}  [CON CUCINA]"
                : "USCITA {$uscitaNum}  SOLO PIZZA";

            $out .= self::BOLD_ON . $signal . self::BOLD_OFF . self::LF;
            $out .= self::divider() . self::LF;

            foreach (self::groupIdenticalPizze($pizze) as $item) {
                $out .= self::formatPizzaPizzeria($item);
                $out .= self::LF;
            }
            $out .= self::LF;
        }

        $out .= self::LF . self::LF;
        $out .= self::CUT;

        return $out;
    }

    // Raggruppa OrderItem identici (stessa pizza, stesse modifiche, stesse
    // note) sommandone le quantita, cosi' invii/duplicati distinti finiscono
    // su un'unica riga di stampa pizzeria.
    private static function groupIdenticalPizze(Collection $pizze): Collection
    {
        return $pizze
            ->groupBy(function ($item) {
                $modKeys = $item->modifications
                    ->map(fn ($mod) => "{$mod->mod_type}:{$mod->mod_value}")
                    ->sort()
                    ->values()
                    ->implode('|');

                return "{$item->pizza_id}|{$modKeys}|{$item->notes}";
            })
            ->map(function (Collection $group) {
                $first = $group->first();
                $first->quantity = $group->sum('quantity');
                return $first;
            })
            ->values();
    }

    private static function formatPizzaPizzeria($item): string
    {
        $mods = $item->modifications;
        $out  = '';

        $qtyStr = "x{$item->quantity}";

        // La base va SEMPRE stampata: il pizzaiolo conta subito quante pizze sono
        // bianche/rosse/ecc. Se il cameriere non ha cambiato la base non esiste un
        // mod 'pizza_base' -> si usa la base di default della pizza.
        $base    = $mods->firstWhere('mod_type', 'pizza_base');
        $baseVal = $base->mod_value ?? ($item->pizza?->default_base ?: 'M');
        $baseStr = "[{$baseVal}]";

        $variantParts = [];
        foreach ($mods as $mod) {
            if (in_array($mod->mod_type, ['pizza_dough', 'pizza_mozzarella', 'variant'], true)) {
                $variantParts[] = "[{$mod->mod_value}]";
            }
        }
        $variantStr = implode(' ', $variantParts);

        $namePart = trim(implode(' ', array_filter([$qtyStr, $baseStr, $variantStr, $item->pizza?->name])));

        $portionParts = [];
        foreach ($mods as $mod) {
            if ($mod->mod_type === 'ingredient_portion') {
                $portionParts[] = $mod->mod_value;
            }
        }
        $portionStr = $portionParts ? '(' . implode(', ', $portionParts) . ')' : '';

        $ingParts = [];
        foreach ($mods as $mod) {
            if ($mod->mod_type === 'ingredient_add')        $ingParts[] = "+{$mod->mod_value}";
            elseif ($mod->mod_type === 'ingredient_remove') $ingParts[] = "-{$mod->mod_value}";
        }
        $ingStr = $ingParts ? '[' . implode(', ', $ingParts) . ']' : '';

        $cook    = $mods->firstWhere('mod_type', 'cooking');
        $cookStr = ($cook && $cook->mod_value !== 'normale') ? strtoupper($cook->mod_value) : '';

        $cut    = $mods->firstWhere('mod_type', 'pizza_cut');
        $cutStr = ($cut && $cut->mod_value !== 'intero') ? strtoupper($cut->mod_value) : '';

        $detail = trim(implode(', ', array_filter([$portionStr, $ingStr, $cookStr, $cutStr])));

        $fullLine = $namePart . ($detail ? ', ' . $detail : '');

        if (mb_strlen($fullLine) <= self::lineWidth()) {
            $out .= self::BOLD_ON . $namePart . self::BOLD_OFF;
            if ($detail) $out .= ', ' . $detail;
            $out .= self::LF;
        } else {
            $out .= self::BOLD_ON
                  . self::wrapText($namePart, self::lineWidth(), self::WRAP_INDENT)
                  . self::BOLD_OFF . self::LF;
            if ($detail) {
                $out .= self::wrapNested($detail) . self::LF;
            }
        }

        if ($item->notes) {
            $out .= self::wrapNested("NOTE: {$item->notes}") . self::LF;
        }

        return $out;
    }

    // ── PRE-CONTO ────────────────────────────────────────────────────────────
    private static function renderPreConto(PrintJob $job): string
    {
        $order = $job->order;
        $out   = '';

        $out .= self::RESET;
        $out .= self::CENTER;
        $out .= self::FONT_DOUBLE . self::tableLabel($order->table) . self::LF . self::FONT_NORMAL;
        $out .= self::BOLD_ON . "* PRE-CONTO *" . self::BOLD_OFF . self::LF;
        $out .= self::LEFT . self::divider() . self::LF;

        $ora = now()->format('H:i');
        $out .= "Comanda #" . str_pad($order->order_number, 4, '0', STR_PAD_LEFT);
        $out .= "   Cop: {$order->covers}   {$ora}" . self::LF;
        $out .= "Cameriere: {$order->user->name} {$order->user->surname}" . self::LF;
        $out .= self::divider() . self::LF;

        // Tutti gli articoli non annullati: inviati + pending
        $activeItems = $order->items()
            ->with(['dish', 'pizza', 'wine', 'modifications'])
            ->where('status', '!=', 'cancelled')
            ->orderBy('sort_order')
            ->get();

        foreach ($activeItems as $item) {
            $name    = match ($item->item_type) {
                'pizza' => $item->pizza?->name,
                'wine'  => $item->wine?->name,
                default => $item->dish?->name,
            };
            $price   = number_format($item->total_price, 2);
            $hasVars = self::compactVariants($item) !== '';
            $base    = "x{$item->quantity} {$name}";
            $label   = ' (con Variante)';

            if ($hasVars && mb_strlen($base . $label) <= self::lineWidth() - mb_strlen($price) - 1) {
                $out .= self::padLine($base . $label, $price, self::lineWidth()) . self::LF;
            } else {
                $out .= self::padLine($base, $price, self::lineWidth()) . self::LF;
                if ($hasVars) {
                    $out .= self::NOTE_INDENT . "(con Variante)" . self::LF;
                }
            }
        }

        $out .= self::divider() . self::LF;

        // Riga coperto — visibile solo se coperto_price > 0
        $copertoPrice = (float)($order->coperto_price ?? 0);
        if ($copertoPrice > 0) {
            $copertoTotal = number_format($order->covers * $copertoPrice, 2);
            $copertoLine  = "Coperto x{$order->covers} (EUR " . number_format($copertoPrice, 2) . ")";
            $out .= self::padLine($copertoLine, $copertoTotal, self::lineWidth()) . self::LF;
        }

        $out .= self::LF;

        $total = number_format($order->total, 2);
        $out .= self::BOLD_ON . self::FONT_DOUBLE . "TOTALE EUR {$total}" . self::FONT_NORMAL . self::BOLD_OFF . self::LF;
        $out .= self::LF . self::LF;
        $out .= self::CUT;

        return $out;
    }

    // ── SCONTRINO PARZIALE (acconto cassa) ──────────────────────────────────
    private static function renderScontrinoParziale(PrintJob $job): string
    {
        $order   = $job->order;
        $payment = $job->orderPayment;
        $out     = '';

        $out .= self::RESET;
        $out .= self::CENTER;
        $out .= self::FONT_DOUBLE . self::tableLabel($order->table) . self::LF . self::FONT_NORMAL;
        $out .= self::BOLD_ON . "* ACCONTO PARZIALE *" . self::BOLD_OFF . self::LF;

        $out .= self::LEFT . self::divider() . self::LF;
        $ora = now()->format('H:i');
        $out .= "Comanda #" . str_pad($order->order_number, 4, '0', STR_PAD_LEFT) . "   {$ora}" . self::LF;
        $out .= self::divider() . self::LF;

        foreach ($payment?->allocations ?? [] as $alloc) {
            if ($alloc->allocation_type === 'coperto') {
                $line = "Coperto x{$alloc->quantity}";
            } else {
                $name = self::itemNameFor($alloc->orderItem);
                $line = "x{$alloc->quantity} {$name}";
            }
            $price = number_format($alloc->subtotal, 2);
            $out  .= self::padLine($line, $price, self::lineWidth()) . self::LF;
        }

        $out .= self::divider() . self::LF;
        $total = number_format($payment?->amount ?? 0, 2);
        $out .= self::BOLD_ON . self::FONT_DOUBLE . "TOTALE TRANCHE EUR {$total}" . self::FONT_NORMAL . self::BOLD_OFF . self::LF;

        $order->refresh();
        $residual = number_format(max(0, $order->total - self::settledTotal($order)), 2);
        $out .= self::LF . "Residuo conto: EUR {$residual}" . self::LF;

        $out .= self::LF . self::LF;
        $out .= self::CUT;

        return $out;
    }

    private static function itemNameFor($item): ?string
    {
        if (!$item) return null;
        return match ($item->item_type) {
            'pizza' => $item->pizza?->name,
            'wine'  => $item->wine?->name,
            default => $item->dish?->name,
        };
    }

    private static function settledTotal($order): float
    {
        return (float) $order->payments()
            ->where('status', '!=', 'voided')
            ->sum('amount');
    }

    /**
     * Costruisce una stringa compatta delle varianti per il pre-conto.
     */
    private static function compactVariants($item): string
    {
        $parts    = [];
        $addCount = 0;
        $remCount = 0;

        foreach ($item->modifications as $mod) {
            switch ($mod->mod_type) {
                case 'pizza_dough':
                case 'pizza_mozzarella':
                    $parts[] = $mod->mod_value;
                    break;
                case 'pizza_base':
                    if ($mod->mod_value !== 'M') $parts[] = $mod->mod_value;
                    break;
                case 'pizza_cut':
                    if ($mod->mod_value !== 'intero') $parts[] = strtoupper($mod->mod_value);
                    break;
                case 'ingredient_add':
                    $addCount++;
                    break;
                case 'ingredient_remove':
                    $remCount++;
                    break;
                case 'portion':
                    if ($mod->mod_value !== 'standard') $parts[] = strtoupper($mod->mod_value);
                    break;
                case 'cooking':
                    if ($mod->mod_value !== 'media') $parts[] = $mod->mod_value;
                    break;
            }
        }

        if ($addCount > 0) $parts[] = "+{$addCount}";
        if ($remCount > 0) $parts[] = "-{$remCount}";

        return $parts ? '(' . implode(', ', $parts) . ')' : '';
    }

    // ── REPORT TERMICO (cassa) ───────────────────────────────────────────────
    private static function renderReportThermal(PrintJob $job): string
    {
        $type = $job->meta['report_type'] ?? 'daily';
        $date = $job->meta['report_date'] ?? now()->toDateString();
        $from = $job->meta['report_from'] ?? null;
        $to   = $job->meta['report_to']   ?? null;

        $svc  = new ReportService();

        $out  = self::RESET;
        $out .= self::CENTER . self::BOLD_ON . 'REPORT' . self::BOLD_OFF . self::LF;

        $out .= match ($type) {
            'weekly'  => self::reportWeeklyBody($svc, $from, $to),
            'dishes'  => self::reportDishesBody($svc, $from, $to),
            'waiters' => self::reportWaitersBody($svc, $from, $to),
            'hourly'  => self::reportHourlyBody($svc, $date),
            default   => self::reportDailyBody($svc, $date),
        };

        // Footer
        $out .= self::LEFT . self::divider() . self::LF;
        $out .= 'Stampato: ' . now()->format('d/m H:i') . self::LF;
        $out .= self::LF . self::LF . self::CUT;

        return $out;
    }

    private static function reportDailyBody(ReportService $svc, string $date): string
    {
        $d   = $svc->daily($date);
        $top = $svc->dishes($date, $date)->take(3);

        $dt     = \Carbon\Carbon::parse($date);
        $giorni = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'];

        $out  = self::CENTER . 'GIORNALIERO' . self::LF;
        $out .= self::LEFT . self::divider() . self::LF;
        $out .= 'Data: ' . $dt->format('d/m/Y') . self::LF;
        $out .= $giorni[$dt->dayOfWeek] . self::LF;
        $out .= self::divider() . self::LF;

        $orders = (int) $d['orders_count'];
        $avg    = $orders > 0 ? $d['total'] / $orders : 0;

        $out .= self::padLine('Fatturato', self::eur($d['total']), self::lineWidth()) . self::LF;
        $out .= 'Tavoli: ' . $orders . '  Cop: ' . (int) $d['covers'] . self::LF;
        $out .= self::padLine('Sc. medio', self::eur($avg), self::lineWidth()) . self::LF;
        $out .= self::divider() . self::LF;

        $out .= self::CENTER . 'TOP 3 PIATTI' . self::LF . self::LEFT;
        if ($top->isEmpty()) {
            $out .= '(nessun dato)' . self::LF;
        } else {
            $i = 1;
            foreach ($top as $row) {
                $name = $row->dish?->name ?? ('#' . $row->dish_id);
                $out .= self::wrapText(" {$i}. {$name} x{$row->total_qty}", self::lineWidth(), self::NOTE_INDENT) . self::LF;
                $out .= self::NOTE_INDENT . self::eur($row->total_revenue) . self::LF;
                $i++;
            }
        }

        return $out;
    }

    private static function reportWeeklyBody(ReportService $svc, ?string $from, ?string $to): string
    {
        $rows = $svc->weekly($from, $to);

        $out  = self::CENTER . 'SETTIMANALE' . self::LF;
        $out .= self::LEFT . self::divider() . self::LF;
        $out .= self::reportRangeLine($from, $to);
        $out .= self::divider() . self::LF;

        $tot = 0;
        if ($rows->isEmpty()) {
            $out .= '(nessun dato)' . self::LF;
        } else {
            foreach ($rows as $r) {
                $label = 'Sett. ' . \Carbon\Carbon::parse($r->week_start)->format('d/m');
                $out  .= self::padLine($label, self::eur($r->revenue), self::lineWidth()) . self::LF;
                $tot  += (float) $r->revenue;
            }
        }

        $out .= self::divider() . self::LF;
        $out .= self::BOLD_ON . self::padLine('TOTALE', self::eur($tot), self::lineWidth()) . self::BOLD_OFF . self::LF;

        return $out;
    }

    private static function reportDishesBody(ReportService $svc, ?string $from, ?string $to): string
    {
        $rows = $svc->dishes($from, $to);
        $top5 = $rows->take(5);
        $best = $rows->sortByDesc('total_revenue')->first();

        $out  = self::CENTER . 'PIATTI' . self::LF;
        $out .= self::LEFT . self::divider() . self::LF;
        $out .= self::reportRangeLine($from, $to);
        $out .= self::divider() . self::LF;

        if ($top5->isEmpty()) {
            $out .= '(nessun dato)' . self::LF;
        } else {
            $i = 1;
            foreach ($top5 as $r) {
                $name = $r->dish?->name ?? ('#' . $r->dish_id);
                $out .= self::padLine(" {$i}. {$name}", 'x' . (int) $r->total_qty, self::lineWidth()) . self::LF;
                $i++;
            }
        }

        if ($best) {
            $bname = $best->dish?->name ?? ('#' . $best->dish_id);
            $out  .= self::divider() . self::LF;
            $out  .= 'Piu redditizio:' . self::LF;
            $out  .= self::wrapText($bname, self::lineWidth(), self::WRAP_INDENT) . self::LF;
            $out  .= self::eur($best->total_revenue) . self::LF;
        }

        return $out;
    }

    private static function reportWaitersBody(ReportService $svc, ?string $from, ?string $to): string
    {
        $rows = $svc->waiters($from, $to)->sortByDesc('revenue')->take(3)->values();

        $out  = self::CENTER . 'CAMERIERI' . self::LF;
        $out .= self::LEFT . self::divider() . self::LF;
        $out .= self::reportRangeLine($from, $to);
        $out .= self::divider() . self::LF;

        if ($rows->isEmpty()) {
            $out .= '(nessun dato)' . self::LF;
        } else {
            $i = 1;
            foreach ($rows as $r) {
                $nome = trim(($r->user?->name ?? '') . ' ' . ($r->user?->surname ?? '')) ?: ('#' . $r->user_id);
                $out .= self::wrapText("{$i}. {$nome}", self::lineWidth(), self::WRAP_INDENT) . self::LF;
                $out .= self::NOTE_INDENT . 'Tavoli: ' . (int) $r->tables_served . self::LF;
                $out .= self::NOTE_INDENT . self::eur($r->revenue) . self::LF;
                $i++;
            }
        }

        return $out;
    }

    private static function reportHourlyBody(ReportService $svc, string $date): string
    {
        $rows = $svc->hourly($date);

        $out  = self::CENTER . 'ORARIO' . self::LF;
        $out .= self::LEFT . self::divider() . self::LF;
        $out .= 'Data: ' . \Carbon\Carbon::parse($date)->format('d/m/Y') . self::LF;
        $out .= self::divider() . self::LF;

        if ($rows->isEmpty()) {
            return $out . '(nessun dato)' . self::LF;
        }

        $max      = max(1, (float) $rows->max('revenue'));
        $tot      = 0;
        $peakHour = null;
        $peakRev  = -1;

        foreach ($rows as $r) {
            $rev  = (float) $r->revenue;
            $tot += $rev;
            if ($rev > $peakRev) {
                $peakRev  = $rev;
                $peakHour = (int) $r->hour;
            }

            $filled = (int) round(($rev / $max) * 8);
            $bar    = str_repeat("\xE2\x96\x88", $filled) . str_repeat('.', 8 - $filled);
            $hh     = str_pad((string) $r->hour, 2, '0', STR_PAD_LEFT);
            $out   .= $hh . ' ' . $bar . ' ' . number_format($rev, 0, ',', '.') . self::LF;
        }

        $out .= self::divider() . self::LF;
        if ($peakHour !== null) {
            $out .= self::padLine('Punta ' . str_pad((string) $peakHour, 2, '0', STR_PAD_LEFT) . ':00', self::eur($peakRev), self::lineWidth()) . self::LF;
        }
        $out .= self::BOLD_ON . self::padLine('TOTALE', self::eur($tot), self::lineWidth()) . self::BOLD_OFF . self::LF;

        return $out;
    }

    private static function reportRangeLine(?string $from, ?string $to): string
    {
        if (!$from || !$to) return '';
        return \Carbon\Carbon::parse($from)->format('d/m')
             . ' - ' . \Carbon\Carbon::parse($to)->format('d/m/Y') . self::LF;
    }

    private static function eur($n): string
    {
        return 'EUR ' . number_format((float) $n, 2, ',', '.');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static function padLine(string $left, string $right, int $width): string
    {
        $available = $width - mb_strlen($right) - 1;
        if (mb_strlen($left) > $available) {
            $left = mb_substr($left, 0, max(1, $available - 1)) . "\xe2\x80\xa6";
        }
        $spaces = $width - mb_strlen($left) - mb_strlen($right);

        return $left . str_repeat(' ', max(1, $spaces)) . $right;
    }

    private static function wrapText(string $text, int $maxWidth, string $indent = ''): string
    {
        $words = preg_split('/\s+/', trim($text));
        $lines = [];
        $line  = '';

        foreach ($words as $word) {
            if ($line === '') {
                $line = (empty($lines) ? '' : $indent) . $word;
            } else {
                $test = $line . ' ' . $word;
                if (mb_strlen($test) <= $maxWidth) {
                    $line = $test;
                } else {
                    $lines[] = $line;
                    $line    = $indent . $word;
                }
            }
        }

        if ($line !== '') $lines[] = $line;

        return implode(self::LF, $lines);
    }

    private static function formatMod($mod): string
    {
        return match ($mod->mod_type) {
            'ingredient_add'     => "+{$mod->mod_value}",
            'ingredient_remove'  => "-{$mod->mod_value}",
            'ingredient_portion' => $mod->mod_value,
            'pizza_dough',
            'pizza_mozzarella',
            'pizza_variant'      => "[{$mod->mod_value}]",
            'pizza_base'         => "[{$mod->mod_value}]",
            'pizza_cut'          => strtoupper($mod->mod_value),
            'portion'            => strtoupper($mod->mod_value),
            'cooking'            => $mod->mod_value,
            'temperature'        => $mod->mod_value,
            'serving'            => $mod->mod_value,
            default              => $mod->mod_value,
        };
    }
}
