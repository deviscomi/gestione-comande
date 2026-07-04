<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            'tablet_pin'          => '1234',
            'inactivity_timeout'  => '300',
            'close_table_message' => 'Confermi la chiusura del tavolo? I dati andranno persi.',
            // Coperto per persona di default (€ 2,00). Cristallizzato sull'ordine alla creazione.
            'coperto_price'       => '2.00',
        ];

        // updateOrCreate: idempotente, aggiorna i valori se il seeder viene rieseguito
        foreach ($settings as $key => $value) {
            SystemSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
