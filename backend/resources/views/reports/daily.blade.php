<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  body  { font-family: Arial, sans-serif; font-size: 13px; margin: 30px; color: #222; }
  h1    { text-align: center; color: #1a56a0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th    { background: #1a56a0; color: #fff; padding: 8px; text-align: left; }
  td    { padding: 7px 8px; border-bottom: 1px solid #ddd; }
  .kpi  { display: inline-block; margin: 8px 20px 8px 0; }
  .kpi-val { font-size: 24px; font-weight: bold; color: #1a56a0; }
  .footer   { margin-top: 30px; font-size: 11px; color: #888; text-align: right; }
</style>
</head>
<body>
<h1>Report Giornaliero — {{ $data['date'] }}</h1>

<div>
  <div class="kpi">
    <div>Fatturato</div>
    <div class="kpi-val">€ {{ number_format($data['total'], 2) }}</div>
  </div>
  <div class="kpi">
    <div>Tavoli Serviti</div>
    <div class="kpi-val">{{ $data['orders_count'] }}</div>
  </div>
  <div class="kpi">
    <div>Coperti Totali</div>
    <div class="kpi-val">{{ $data['covers'] }}</div>
  </div>
  @if(($data['covers'] ?? 0) > 0)
  <div class="kpi">
    <div>Media/Coperto</div>
    <div class="kpi-val">€ {{ number_format($data['total'] / $data['covers'], 2) }}</div>
  </div>
  @endif
</div>

<div class="footer">
  Generato il {{ now()->format('d/m/Y H:i') }} — Gestione Comande
</div>
</body>
</html>
