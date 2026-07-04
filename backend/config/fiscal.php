<?php

return [
    // Aliquota IVA applicata alle righe di scontrino: il sistema non traccia ancora
    // un'aliquota per piatto/pizza/vino, quindi viene usato un valore unico di default.
    'default_vat_rate' => (float) env('FISCAL_DEFAULT_VAT_RATE', 0.10),
];
