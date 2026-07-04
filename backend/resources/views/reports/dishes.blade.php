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
<h1>Piatti più venduti</h1>
<h2>Dal {{ $data['from'] ?? '—' }} al {{ $data['to'] ?? '—' }}</h2>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Piatto</th>
      <th>Categoria</th>
      <th class="num">Quantità</th>
      <th class="num">Fatturato</th>
    </tr>
  </thead>
  <tbody>
    @forelse($data['rows'] ?? [] as $i => $row)
      <tr>
        <td>{{ $i + 1 }}</td>
        <td>{{ $row['dish']['name'] ?? ('Piatto #' . ($row['dish_id'] ?? '?')) }}</td>
        <td>{{ $row['dish']['category']['name'] ?? '—' }}</td>
        <td class="num">{{ $row['total_qty'] ?? 0 }}</td>
        <td class="num">€ {{ number_format((float) ($row['total_revenue'] ?? 0), 2) }}</td>
      </tr>
    @empty
      <tr><td colspan="5">Nessun dato nel periodo selezionato.</td></tr>
    @endforelse
  </tbody>
</table>

<div class="footer">
  Generato il {{ now()->format('d/m/Y H:i') }} — Gestione Comande
</div>
</body>
</html>
