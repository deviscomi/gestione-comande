# AGENT 05 — PrintDispatcher & Sistema ESC/POS

**Dipendenze:** AGENT_01 + 02 + 03 + 04 completati. `POST /send` deve chiamare `PrintDispatcher::dispatch()`.
**Output atteso:** Logica stampa completa — matrice invii, template ESC/POS, coda retry, PDF backup, notifiche WS.

---

## Obiettivo

Implementare il sistema di stampa termica:
- `PrintDispatcher`: analizza l'invio e determina quali stampe attivare
- `ProcessPrintJob`: Queue Job con retry automatico via TCP/IP ESC/POS
- Template ESC/POS per cassiere, cucina e pizzeria
- `PdfBackupGenerator`: PDF di backup quando la stampante non risponde
- Endpoint retry, ristampa, gestione coda

---

## PrintDispatcher — `app/Services/PrintDispatcher.php`

```php
<?php
namespace App\Services;

use App\Models\{Order, OrderSend, PrintJob, Printer};
use App\Jobs\ProcessPrintJob;
use Illuminate\Support\Collection;

class PrintDispatcher
{
    public static function dispatch(Order $order, OrderSend $send, Collection $items): Collection
    {
        $printTypes = self::determinePrintTypes($order, $send, $items);
        $jobs = collect();

        foreach ($printTypes as $type) {
            $printer = Printer::where('department', $type)
                ->where('is_active', true)->first();

            $job = PrintJob::create([
                'order_id'      => $order->id,
                'order_send_id' => $send->id,
                'printer_id'    => $printer?->id,
                'print_type'    => $type,
                'status'        => 'pending',
            ]);

            ProcessPrintJob::dispatch($job->id)->onQueue('printing');
            $jobs->push($job);
        }

        return $jobs;
    }

    private static function determinePrintTypes(Order $order, OrderSend $send, Collection $items): array
    {
        $isFirstSend = $order->sends()->where('send_number', 1)->exists()
            && $send->send_number === 1;

        if ($isFirstSend) {
            // Primo invio: sempre cassiere + cucina. Pizzeria solo se ci sono pizze.
            $types = ['cassiere', 'cucina'];
            if ($items->where('item_type', 'pizza')->isNotEmpty()) {
                $types[] = 'pizzeria';
            }
            return $types;
        }

        // Invii successivi
        $departments = self::classifyItems($items);
        $hasPizzas   = in_array('pizzeria', $departments);
        $hasKitchen  = in_array('cucina', $departments);
        $hasBevOnly  = $departments === ['bevande'] || $departments === ['dessert'] || $departments === ['amari']
                    || count(array_diff($departments, ['bevande','dessert','amari'])) === 0;

        $types = ['cassiere']; // Cassiere sempre

        if ($hasPizzas) {
            // Pizze: ristampa cucina + pizzeria
            $types[] = 'cucina';
            $types[] = 'pizzeria';
        } elseif ($hasBevOnly) {
            // Solo bevande/dessert/amari: solo aggiunta cucina
            $types[] = 'cucina'; // solo aggiunta
        } else {
            // Cucina (no pizze)
            $types[] = 'cucina';

            // Pizzeria solo se nell'ordine esistono già pizze da invii precedenti
            $hasPreviousPizzas = $order->items()
                ->where('item_type', 'pizza')
                ->where('status', 'sent')
                ->where('order_send_id', '!=', $send->id)
                ->exists();

            if ($hasPreviousPizzas) {
                $types[] = 'pizzeria'; // con flag CUCINA
            }
        }

        return array_unique($types);
    }

    private static function classifyItems(Collection $items): array
    {
        $departments = [];
        foreach ($items as $item) {
            if ($item->item_type === 'pizza') {
                $departments[] = 'pizzeria';
            } elseif ($item->item_type === 'dish') {
                $dept = $item->dish?->category?->department ?? 'cucina';
                $departments[] = $dept;
            }
        }
        return array_unique($departments);
    }
}
```

---

## ProcessPrintJob — `app/Jobs/ProcessPrintJob.php`

```php
<?php
namespace App\Jobs;

use App\Models\PrintJob;
use App\Services\{EscPosRenderer, PdfBackupGenerator};
use App\Events\PrintJobStatusChanged;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessPrintJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 10;
    public int $maxExceptions = 3;

    public function __construct(public int $printJobId) {}

    public function handle(): void
    {
        $job = PrintJob::with(['order.table.zone', 'order.items.modifications',
                               'order.user', 'orderSend.items', 'printer'])->find($this->printJobId);

        if (!$job || $job->status === 'done') return;

        $printer = $job->printer;
        if (!$printer) {
            $this->fail('Nessuna stampante configurata per ' . $job->print_type);
            return;
        }

        $job->update(['status' => 'printing', 'attempts' => $job->attempts + 1]);

        // Genera payload ESC/POS
        $payload = EscPosRenderer::render($job);

        // Connessione TCP/IP
        $socket = @fsockopen($printer->ip_address, $printer->port, $errno, $errstr, 3);

        if (!$socket) {
            $job->update(['status' => 'pending']);
            broadcast(new PrintJobStatusChanged($job->fresh()));
            // Retry dopo 30 secondi
            $this->release(30);
            return;
        }

        fwrite($socket, $payload);
        fclose($socket);

        $job->update(['status' => 'done', 'printed_at' => now()]);
        broadcast(new PrintJobStatusChanged($job->fresh()));
    }

    public function failed(\Throwable $exception): void
    {
        $job = PrintJob::find($this->printJobId);
        if (!$job) return;

        $pdfPath = PdfBackupGenerator::generate($job);
        $job->update(['status' => 'failed', 'pdf_backup_path' => $pdfPath]);
        broadcast(new PrintJobStatusChanged($job->fresh()));
    }
}
```

---

## EscPosRenderer — `app/Services/EscPosRenderer.php`

### Costanti ESC/POS
```php
const ESC  = "\x1B";
const GS   = "\x1D";
const RESET       = self::ESC . "@";
const CENTER      = self::ESC . "a\x01";
const LEFT        = self::ESC . "a\x00";
const BOLD_ON     = self::ESC . "E\x01";
const BOLD_OFF    = self::ESC . "E\x00";
const FONT_NORMAL = self::GS . "!\x00";
const FONT_DOUBLE = self::GS . "!\x11"; // doppia altezza
const FONT_LARGE  = self::GS . "!\x30"; // quadrupla
const CUT         = self::GS . "V\x42\x00"; // taglio parziale
const LF          = "\n";
const DIVIDER     = "--------------------------------";
```

### render()
```php
public static function render(PrintJob $job): string
{
    return match($job->print_type) {
        'cassiere' => self::renderCassiere($job),
        'cucina'   => self::renderCucina($job),
        'pizzeria' => self::renderPizzeria($job),
    };
}
```

### renderCassiere()
```
RESET + CENTER
FONT_DOUBLE + "Comanda #" + order_number + LF + FONT_NORMAL
[*** RISTAMPA ***] se is_reprint
LEFT + DIVIDER + LF
"Tav X [Zona]   Coperti: N   HH:MM" + LF
"Cameriere: [Nome]" + LF
DIVIDER + LF

Per ogni categoria con articoli:
  BOLD_ON + "CATEGORIA" + BOLD_OFF + LF
  Per ogni articolo:
    "x[qty] [Nome]" + spazi + "[prezzo]" + LF
    Per ogni modifica:
      "  > [descrizione modifica]" + LF
    Se note:
      "  NOTE: [testo]" + LF

DIVIDER + LF
BOLD_ON + FONT_DOUBLE + "TOTALE EUR [XX.XX]" + FONT_NORMAL + BOLD_OFF + LF
LF + LF
CUT
```

### renderCucina()
```
RESET + CENTER
FONT_DOUBLE + "Comanda #" + order_number + LF + FONT_NORMAL
[*** RISTAMPA ***] se is_reprint
Se solo_aggiunta: CENTER + "--- AGGIUNTA ---" + LF
LEFT + DIVIDER + LF
Header (stesso del cassiere, no prezzo) + LF

Per ogni categoria con articoli in ordine sort_order:
  BOLD_ON + "--- CATEGORIA ---" + BOLD_OFF + LF
  Per ogni articolo:
    "x[qty] [Nome]" + LF
    Se porzione poco:       "  > POCO" + LF
    Se porzione abbondante: "  > ABBONDANTE" + LF
    Se cottura:             "  > COTTURA: [valore]" + LF
    Se ingredienti pizza:   "  > [lista varianti e modifiche]" + LF
    Se note: "  NOTE: [testo]" + LF

LF + LF + CUT
```

### renderPizzeria()
```
RESET + CENTER
FONT_DOUBLE + "Comanda #" + order_number + LF + FONT_NORMAL
[*** RISTAMPA ***] se is_reprint

Segnali in cima (FONT_LARGE):
  Se antipasti presenti nell'ordine:   "⏳ ATTESA" + LF
  Se articoli cucina nel send:         "★ CUCINA" + LF

DIVIDER + LF
LEFT
"Tav X [Zona]   Coperti: N   HH:MM" + LF
DIVIDER + LF

Per ogni pizza nel send:
  Varianti (solo non-default): "[CERE] [R] [NO LATT.]"
  BOLD_ON + "[Varianti] [Nome Pizza]" + BOLD_OFF
  Modifiche: "(+funghi, -salame, poco peperoncino)"
  Se taglio spicchi: " [SPICCHI]"
  Se taglio meta':   " [META']"
  + LF
  Se note: "  NOTE: [testo]" + LF
  + LF (riga vuota tra pizze)

LF + LF + CUT
```

---

## PdfBackupGenerator — `app/Services/PdfBackupGenerator.php`

```php
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

public static function generate(PrintJob $job): string
{
    $html = view('print.' . $job->print_type, ['job' => $job])->render();
    $pdf = Pdf::loadHTML($html)->setPaper('a4');

    $path = "print_backups/order_{$job->order_id}_send_{$job->order_send_id}_{$job->print_type}.pdf";
    Storage::put($path, $pdf->output());

    return $path;
}
```

Creare view blade in `resources/views/print/`: `cassiere.blade.php`, `cucina.blade.php`, `pizzeria.blade.php`
che replicano il layout delle stampe termiche in formato HTML.

---

## PrintController — endpoint ristampa e retry

```php
// POST /print-jobs/{id}/retry
public function retry(PrintJob $job) {
    if ($job->status === 'done') {
        return response()->json(['message' => 'Job già completato'], 422);
    }
    $job->update(['status' => 'pending', 'attempts' => 0]);
    ProcessPrintJob::dispatch($job->id)->onQueue('printing');
    return new PrintJobResource($job);
}

// POST /print-jobs/{id}/reprint
public function reprint(PrintJob $job) {
    $newJob = PrintJob::create([
        'order_id'      => $job->order_id,
        'order_send_id' => $job->order_send_id,
        'printer_id'    => $job->printer_id,
        'print_type'    => $job->print_type,
        'status'        => 'pending',
        'is_reprint'    => true, // aggiungi questo campo alla migrazione
    ]);
    ProcessPrintJob::dispatch($newJob->id)->onQueue('printing');
    return new PrintJobResource($newJob);
}
```

---

## PrintJobStatusChanged Event

```php
class PrintJobStatusChanged implements ShouldBroadcast {
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public PrintJob $printJob) {}

    public function broadcastOn(): array {
        return [new PrivateChannel("print-jobs.{$this->printJob->id}")];
    }

    public function broadcastWith(): array {
        return [
            'job_id'          => $this->printJob->id,
            'print_type'      => $this->printJob->print_type,
            'status'          => $this->printJob->status,
            'attempts'        => $this->printJob->attempts,
            'pdf_backup_path' => $this->printJob->pdf_backup_path,
        ];
    }
}
```

---

## Criteri di completamento

- [ ] `PrintDispatcher::dispatch()` con primo invio pizza crea 3 job (cassiere, cucina, pizzeria)
- [ ] `PrintDispatcher::dispatch()` con solo bevande crea 1 job (cassiere)
- [ ] `ProcessPrintJob` connette alla stampante Bisofice POS-8370 via TCP/IP porta 9100
- [ ] Stampa cassiere include prezzi e totale
- [ ] Stampa cucina NON include prezzi, include divisori portate
- [ ] Stampa pizzeria mostra segnali ATTESA/CUCINA in cima, varianti pizza prima del nome
- [ ] `*** RISTAMPA ***` presente su job con `is_reprint=true`
- [ ] Se stampante offline: `attempts` incrementa, job `release(30)`, notifica WS inviata
- [ ] PDF backup generato su `failed`, path salvato in `print_jobs.pdf_backup_path`
- [ ] PDF eliminato da `PATCH /orders/{id}/close`
