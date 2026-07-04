<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  body  { font-family: Arial, sans-serif; font-size: 13px; margin: 30px; color: #222; }
  h1    { text-align: center; color: #1a56a0; }
  h2    { text-align: center; color: #555; font-size: 13px; font-weight: normal; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th    { background: #1a56a0; color: #fff; padding: 8px; text-align: left; }
  td    { padding: 7px 8px; border-bottom: 1px solid #ddd; }
  .num  { text-align: right; }
  .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: right; }
</style>
</head>
<body>
<h1>Report settimanale</h1>
<h2>Dal {{ $data['from'] ?? '—' }} al {{ $data['to'] ?? '—' }}</h2>

<table>
  <thead>
    <tr>
      <th>Settimana (inizio)</th>
      <th class="num">Ordini</th>
      <th class="num">Coperti</th>
      <th class="num">Fatturato</th>
    </tr>
  </thead>
  <tbody>
    @forelse($data['rows'] ?? [] as $row)
      <tr>
        <td>{{ $row['week_start'] ?? ('Sett. ' . ($row['week'] ?? '?')) }}</td>
        <td class="num">{{ $row['orders'] ?? 0 }}</td>
        <td class="num">{{ $row['covers'] ?? 0 }}</td>
        <td class="num">€ {{ number_format((float) ($row['revenue'] ?? 0), 2) }}</td>
      </tr>
    @empty
      <tr><td colspan="4">Nessun dato nel periodo selezionato.</td></tr>
    @endforelse
  </tbody>
</table>

<div class="footer">
  Generato il {{ now()->format('d/m/Y H:i') }} — Gestione Comande
</div>
</body>
</html>
