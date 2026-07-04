# Prompt per VSCode — Pulsante "PDF Pre-conto"

Implementa un nuovo pulsante "PDF Pre-conto" accanto al pulsante "Pre-conto" esistente, che permetta di visualizzare il PDF del pre-conto su richiesta (senza passare dalla stampante), per i casi in cui non è possibile stampare.

## Contesto
Il pulsante "Pre-conto" esistente è in `frontend/src/pages/tablet/OrderScreen.jsx` (righe 248-271): invia il pre-conto alla stampante della cassa via ESC/POS (porta TCP 9100, gestito dal job `ProcessPrintJob`). Se la stampa fallisce dopo 5 tentativi, il sistema genera già automaticamente un PDF di fallback tramite `App\Services\PdfBackupGenerator::generate()` (libreria `barryvdh/laravel-dompdf`), salvato in `storage/app/print_backups/`. Questo backup avviene solo *dopo un fallimento di stampa* — non è disponibile a richiesta del cameriere in qualsiasi momento.

## Modifiche da fare

### Backend (Laravel)

1. In `backend/app/Services/PdfBackupGenerator.php`, aggiungi un nuovo metodo statico `generateOnDemand(Order $order): string` che:
   - Calcola `$lastSendId` con la stessa query usata in `OrderController::preConto()` (`$order->sends()->where('send_number', '>', 0)->latest('send_number')->value('id')`).
   - Carica le stesse relazioni eager-load già usate in `generate()` (righe 18-27: `order.table.zone`, `order.user`, `order.items.modifications`, `order.items.dish.category`, `order.items.pizza`, `orderSend.items.modifications`, `orderSend.items.dish.category`, `orderSend.items.pizza`) — adatta i nomi delle relazioni a quanto serve dato che non hai un `$job`, lavora con `$order` e l'eventuale `OrderSend` corrispondente a `$lastSendId`.
   - Renderizza la view `print.pre_conto` (verifica le variabili che la view si aspetta in `resources/views/print/pre_conto.blade.php` e passale correttamente, es. un oggetto compatibile con `$job->order`/`$job->orderSend` oppure adatta la view per accettare direttamente `$order` e `$orderSend`).
   - Genera il PDF con `Pdf::loadHTML($html)->setPaper('a4')` e ritorna `$pdf->output()` (i bytes), **senza salvare nulla su Storage** (è una generazione ad-hoc, non un backup persistente — non deve interferire con `PdfBackupGenerator::deleteForOrder()` chiamato alla chiusura tavolo).

2. In `backend/routes/api.php`, vicino alla riga 166 (route `pre-conto` esistente), aggiungi:
   ```php
   Route::get('orders/{order}/pre-conto/pdf', [OrderController::class, 'preContoPdf']);
   ```

3. In `backend/app/Http/Controllers/Api/V1/OrderController.php`, dopo il metodo `preConto()` (circa riga 192), aggiungi:
   ```php
   public function preContoPdf(Order $order)
   {
       if ($order->status === 'closed') {
           return response()->json(['message' => 'Ordine chiuso'], 422);
       }

       $pdfContent = PdfBackupGenerator::generateOnDemand($order);

       return response($pdfContent, 200, [
           'Content-Type' => 'application/pdf',
           'Content-Disposition' => "inline; filename=\"pre_conto_ordine_{$order->order_number}.pdf\"",
       ]);
   }
   ```
   - A differenza di `preConto()`, questo endpoint NON blocca gli ordini `locked` (sola lettura ma consultabile) — blocca solo `closed`.
   - Aggiungi una chiamata a `$this->logActivity('PRE_CONTO_PDF_VIEWED', "PDF pre-conto ordine #{$order->order_number} visualizzato", $order)` per coerenza con le altre azioni rilevanti già loggate nel controller (regola del progetto: ogni operazione rilevante va loggata tramite `ActivityLogger`).
   - Assicurati che il tipo di ritorno e gli import (`PdfBackupGenerator`, eventuale `Illuminate\Http\Response`) siano corretti.

### Frontend (React)

4. In `frontend/src/api/endpoints/orders.js`, accanto a `preContoOrder` (riga 23), aggiungi:
   ```javascript
   preContoPdf: (orderId) => api.get(`/orders/${orderId}/pre-conto/pdf`, { responseType: 'blob' }),
   ```

5. In `frontend/src/pages/tablet/OrderScreen.jsx`:
   - Aggiungi uno stato `const [pdfLoading, setPdfLoading] = useState(false)` vicino agli altri stati del componente.
   - Aggiungi una funzione handler:
     ```javascript
     const handlePreContoPdf = async () => {
       setPdfLoading(true)
       try {
         const res = await ordersApi.preContoPdf(orderId)
         const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
         window.open(url, '_blank')
       } catch (err) {
         alert(err.response?.data?.message ?? 'Errore nella generazione del PDF pre-conto')
       } finally {
         setPdfLoading(false)
       }
     }
     ```
   - Aggiungi un nuovo pulsante "PDF Pre-conto" nella "Send bar" (righe 246-271), **subito dopo** il pulsante "Pre-conto" esistente ma **fuori** dal blocco condizionale `{printingEnabled && (...)}` — deve essere sempre visibile, perché il caso d'uso principale è proprio quando la stampa non è disponibile. Stile coerente con il pulsante esistente ma colore "info" per distinguerlo:
     ```jsx
     <button
       disabled={pdfLoading}
       onClick={handlePreContoPdf}
       title="Visualizza PDF pre-conto"
       style={{
         padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
         background: 'var(--color-background-info)',
         color: 'var(--color-text-info)',
         border: '1px solid var(--color-border-info)',
         opacity: pdfLoading ? 0.7 : 1,
         cursor: pdfLoading ? 'not-allowed' : 'pointer',
         transition: 'all .2s',
       }}
     >
       {pdfLoading ? '...' : 'PDF Pre-conto'}
     </button>
     ```
   - Usa esclusivamente CSS variables (`var(--color-*)`) per i colori, come richiesto dalle regole del progetto (dark mode automatica).

## Verifica
1. `php artisan route:list | grep pre-conto` per confermare che la nuova route GET sia registrata.
2. Apri un ordine sul tablet, clicca "PDF Pre-conto": verifica che si apra una nuova tab con il PDF corretto (tavolo, articoli, totale).
3. Verifica che il file NON venga salvato in `storage/app/print_backups/` (controlla la cartella dopo la richiesta).
4. Testa il caso di errore con un ordine `closed`: deve restituire 422 con messaggio "Ordine chiuso" e l'alert deve comparire sul frontend.
5. Verifica che il pulsante "PDF Pre-conto" funzioni anche con `printingEnabled = false` e con ordini `locked`.
