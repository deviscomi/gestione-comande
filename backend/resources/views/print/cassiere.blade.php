<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
  h2   { text-align: center; margin: 4px 0; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .header  { margin: 4px 0; }
  .cat     { font-weight: bold; margin-top: 6px; text-transform: uppercase; }
  .item    { display: flex; justify-content: space-between; }
  .mod     { margin-left: 16px; color: #444; }
  .note    { margin-left: 16px; font-style: italic; }
  .total   { font-size: 16px; font-weight: bold; text-align: right; margin-top: 8px; }
  .reprint { text-align: center; font-weight: bold; color: red; }
</style>
</head>
<body>
<h2>Comanda #{{ $job->order->order_number }}</h2>

@if($job->is_reprint)
<p class="reprint">*** RISTAMPA ***</p>
@endif

<div class="divider"></div>
<div class="header">
  Tav {{ $job->order->table->number }} [{{ $job->order->table->zone->name }}]
  &nbsp;&nbsp;Cop: {{ $job->order->covers }}
  &nbsp;&nbsp;{{ $job->order->first_sent_at?->format('H:i') ?? now()->format('H:i') }}
</div>
<div class="header">Cameriere: {{ $job->order->user->name }} {{ $job->order->user->surname }}</div>
<div class="divider"></div>

@php
  $activeItems = $job->order->items->filter(fn($i) => $i->status !== 'cancelled');
  $grouped = $activeItems->groupBy(fn($i) => $i->item_type === 'pizza' ? 'Pizze' : ($i->dish?->category?->name ?? 'Altro'));
@endphp

@foreach($grouped as $catName => $items)
<div class="cat">{{ $catName }}</div>
@foreach($items as $item)
<div class="item">
  <span>x{{ $item->quantity }} {{ $item->item_type === 'pizza' ? $item->pizza?->name : $item->dish?->name }}</span>
  <span>€ {{ number_format($item->total_price, 2) }}</span>
</div>
@foreach($item->modifications as $mod)
<div class="mod">&gt; {{ $mod->mod_value }}</div>
@endforeach
@if($item->notes)
<div class="note">NOTE: {{ $item->notes }}</div>
@endif
@endforeach
@endforeach

<div class="divider"></div>
<div class="total">TOTALE EUR {{ number_format($job->order->total, 2) }}</div>
</body>
</html>
