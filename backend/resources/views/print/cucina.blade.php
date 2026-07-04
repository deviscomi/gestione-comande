<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Courier New', monospace; font-size: 13px; margin: 20px; }
  h2   { text-align: center; margin: 4px 0; }
  .divider  { border-top: 1px dashed #000; margin: 4px 0; }
  .aggiunta { text-align: center; font-weight: bold; font-size: 15px; margin: 4px 0; }
  .cat      { font-weight: bold; margin-top: 6px; border-bottom: 1px solid #ccc; }
  .item     { font-size: 14px; margin: 2px 0; }
  .mod      { margin-left: 16px; }
  .note     { margin-left: 16px; font-style: italic; }
  .reprint  { text-align: center; font-weight: bold; color: red; }
</style>
</head>
<body>
<h2>Comanda #{{ $job->order->order_number }}</h2>

@if($job->is_reprint)
<p class="reprint">*** RISTAMPA ***</p>
@endif

@if($job->orderSend->send_number > 1)
<div class="aggiunta">--- AGGIUNTA #{{ $job->orderSend->send_number }} ---</div>
@endif

<div class="divider"></div>
<div>
  Tav {{ $job->order->table->number }} [{{ $job->order->table->zone->name }}]
  &nbsp;&nbsp;Cop: {{ $job->order->covers }}
  &nbsp;&nbsp;{{ $job->orderSend->sent_at?->format('H:i') ?? now()->format('H:i') }}
</div>
<div class="divider"></div>

@php
  $items = $job->orderSend->items->sortBy('sort_order');
  $grouped = $items->groupBy(fn($i) => $i->item_type === 'pizza' ? 'Pizze' : ($i->dish?->category?->name ?? 'Altro'));
@endphp

@foreach($grouped as $catName => $catItems)
<div class="cat">--- {{ strtoupper($catName) }} ---</div>
@foreach($catItems as $item)
<div class="item">x{{ $item->quantity }} {{ $item->item_type === 'pizza' ? $item->pizza?->name : $item->dish?->name }}</div>
@foreach($item->modifications as $mod)
<div class="mod">&gt; {{ $mod->mod_value }}</div>
@endforeach
@if($item->notes)
<div class="note">NOTE: {{ $item->notes }}</div>
@endif
@endforeach
@endforeach
</body>
</html>
