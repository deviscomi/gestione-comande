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
  .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: right; }
</style>
</head>
<body>
@php
    $rows = $data['rows'] ?? (array_is_list($data ?? []) ? $data : []);
    $columns = !empty($rows) ? array_keys(array_filter($rows[0], fn($v) => !is_array($v))) : [];
@endphp

<h1>Report — {{ ucfirst($type ?? 'generico') }}</h1>
@if(isset($data['from']) || isset($data['to']))
  <h2>Dal {{ $data['from'] ?? '—' }} al {{ $data['to'] ?? '—' }}</h2>
@elseif(isset($data['date']))
  <h2>{{ $data['date'] }}</h2>
@endif

<table>
  <thead>
    <tr>
      @foreach($columns as $col)
        <th>{{ ucwords(str_replace('_', ' ', $col)) }}</th>
      @endforeach
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $row)
      <tr>
        @foreach($columns as $col)
          <td>{{ is_scalar($row[$col] ?? null) ? $row[$col] : '—' }}</td>
        @endforeach
      </tr>
    @empty
      <tr><td>Nessun dato disponibile.</td></tr>
    @endforelse
  </tbody>
</table>

<div class="footer">
  Generato il {{ now()->format('d/m/Y H:i') }} — Gestione Comande
</div>
</body>
</html>
