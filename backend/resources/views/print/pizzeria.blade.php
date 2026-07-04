<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Courier New', monospace; font-size: 13px; margin: 20px; }
  h2   { text-align: center; margin: 4px 0; }
  .divider  { border-top: 1px dashed #000; margin: 4px 0; }
  .signal   { font-size: 20px; font-weight: bold; text-align: center; margin: 4px 0; }
  .pizza    { font-size: 15px; font-weight: bold; margin: 6px 0 2px; }
  .mod      { margin-left: 12px; }
  .note     { margin-left: 12px; font-style: italic; }
  .reprint  { text-align: center; font-weight: bold; color: red; }
</style>
</head>
<body>
<h2>Comanda #{{ $job->order->order_number }}</h2>

@if($job->is_reprint)
<p class="reprint">*** RISTAMPA ***</p>
@endif

@php
  $hasAntipasti = $job->order->items
    ->where('status', 'sent')
    ->filter(fn($i) => $i->dish?->category?->name === 'Antipasti')
    ->isNotEmpty();

  $hasKitchen = $job->orderSend->items->where('item_type', 'dish')->isNotEmpty();
@endphp

@if($hasAntipasti)
<div class="signal">⏳ ATTESA</div>
@endif
@if($hasKitchen)
<div class="signal">★ CUCINA</div>
@endif

<div class="divider"></div>
<div>
  Tav {{ $job->order->table->number }} [{{ $job->order->table->zone->name }}]
  &nbsp;&nbsp;Cop: {{ $job->order->covers }}
  &nbsp;&nbsp;{{ $job->orderSend->sent_at?->format('H:i') ?? now()->format('H:i') }}
</div>
<div class="divider"></div>

@foreach($job->orderSend->items->where('item_type', 'pizza') as $item)
@php
  $baseMod    = $item->modifications->firstWhere('mod_type', 'pizza_base');
  // La base va SEMPRE stampata (default della pizza se il cameriere non l'ha cambiata).
  $baseVal    = $baseMod->mod_value ?? ($item->pizza?->default_base ?: 'M');
  $variants   = $item->modifications
    ->whereIn('mod_type', ['pizza_dough', 'pizza_mozzarella', 'variant'])
    ->pluck('mod_value')->implode('] [');
  $portionMods = $item->modifications->where('mod_type', 'ingredient_portion')->pluck('mod_value')->implode(', ');
  $addMods    = $item->modifications->where('mod_type', 'ingredient_add')->pluck('mod_value')->map(fn($v) => "+{$v}");
  $removeMods = $item->modifications->where('mod_type', 'ingredient_remove')->pluck('mod_value')->map(fn($v) => "-{$v}");
  $ingMods    = $addMods->concat($removeMods)->implode(', ');
  $cookMod    = $item->modifications->firstWhere('mod_type', 'cooking');
  $cutMod     = $item->modifications->firstWhere('mod_type', 'pizza_cut');
@endphp
<div class="pizza">
  x{{ $item->quantity }}
  [{{ $baseVal }}]
  @if($variants)[{{ $variants }}] @endif
  {{ $item->pizza?->name }}
  @if($portionMods) ({{ $portionMods }})@endif
  @if($ingMods) [{{ $ingMods }}]@endif
  @if($cookMod && $cookMod->mod_value !== 'normale') {{ strtoupper($cookMod->mod_value) }}@endif
  @if($cutMod && $cutMod->mod_value !== 'intero') {{ strtoupper($cutMod->mod_value) }}@endif
</div>
@if($item->notes)
<div class="note">NOTE: {{ $item->notes }}</div>
@endif
@endforeach
</body>
</html>
