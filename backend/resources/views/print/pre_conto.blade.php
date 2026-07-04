<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
  h2   { text-align: center; margin: 4px 0; }
  h3   { text-align: center; margin: 2px 0; font-size: 13px; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .header  { margin: 4px 0; }
  .cat     { font-weight: bold; margin-top: 6px; text-transform: uppercase; }
  .item    { display: flex; justify-content: space-between; }
  .variants { margin-left: 16px; color: #555; font-size: 11px; }
  .total   { font-size: 16px; font-weight: bold; text-align: right; margin-top: 8px; }
</style>
</head>
<body>
<h2>Comanda #{{ str_pad($job->order->order_number, 4, '0', STR_PAD_LEFT) }}</h2>
<h3>PRE-CONTO</h3>

<div class="divider"></div>
<div class="header">
  Tav {{ $job->order->table->number }} [{{ $job->order->table->zone->name }}]
  &nbsp;&nbsp;Cop: {{ $job->order->covers }}
  &nbsp;&nbsp;{{ now()->format('H:i') }}
</div>
<div class="header">Cameriere: {{ $job->order->user->name }} {{ $job->order->user->surname }}</div>
<div class="divider"></div>

@php
  $activeItems = $job->order->items->filter(fn($i) => $i->status !== 'cancelled');
  $grouped = $activeItems
    ->sortBy('sort_order')
    ->groupBy(fn($i) => $i->item_type === 'pizza' ? 'Pizze' : ($i->dish?->category?->name ?? 'Altro'));

  function preContoVariants($item): string {
    $parts = []; $add = 0; $rem = 0;
    foreach ($item->modifications as $mod) {
      switch ($mod->mod_type) {
        case 'pizza_dough': case 'pizza_mozzarella': $parts[] = $mod->mod_value; break;
        case 'pizza_base':  if ($mod->mod_value !== 'M') $parts[] = $mod->mod_value; break;
        case 'pizza_cut':   if ($mod->mod_value !== 'intero') $parts[] = strtoupper($mod->mod_value); break;
        case 'ingredient_add':    $add++; break;
        case 'ingredient_remove': $rem++; break;
        case 'portion': if ($mod->mod_value !== 'standard') $parts[] = strtoupper($mod->mod_value); break;
        case 'cooking':  if ($mod->mod_value !== 'media') $parts[] = $mod->mod_value; break;
      }
    }
    if ($add > 0) $parts[] = "+{$add}";
    if ($rem > 0) $parts[] = "-{$rem}";
    return $parts ? '(' . implode(', ', $parts) . ')' : '';
  }
@endphp

@foreach($grouped as $catName => $items)
<div class="cat">{{ $catName }}</div>
@foreach($items as $item)
@php $variants = preContoVariants($item); @endphp
<div class="item">
  <span>x{{ $item->quantity }} {{ $item->item_type === 'pizza' ? $item->pizza?->name : $item->dish?->name }}
    @if($variants) <span class="variants">{{ $variants }}</span>@endif
  </span>
  <span>€ {{ number_format($item->total_price, 2) }}</span>
</div>
@endforeach
@endforeach

<div class="divider"></div>
@php $copertoPrice = (float)($job->order->coperto_price ?? 0); @endphp
@if($copertoPrice > 0)
<div class="item">
  <span>Coperto x{{ $job->order->covers }} (€ {{ number_format($copertoPrice, 2) }})</span>
  <span>€ {{ number_format($job->order->covers * $copertoPrice, 2) }}</span>
</div>
@endif
<div class="total">TOTALE EUR {{ number_format($job->order->total, 2) }}</div>
</body>
</html>
