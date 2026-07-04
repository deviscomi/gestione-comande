<?php

namespace Database\Seeders;

use App\Models\FiscalDevice;
use Illuminate\Database\Seeder;

class FiscalDeviceSeeder extends Seeder
{
    public function run(): void
    {
        // Registratore Telematico dimostrativo: popola la pagina "Registratori RT"
        // quando il modulo fiscal è attivo. Inattivo per non generare emissioni fallite.
        FiscalDevice::firstOrCreate(
            ['name' => 'Registratore Demo'],
            [
                'driver'               => 'epson_fp',
                'connection_type'      => 'lan_tcp',
                'ip_address'           => '192.168.1.50',
                'port'                 => 9100,
                'fiscal_serial_number' => 'DEMO0001',
                'vat_number'           => '01234567890',
                'is_active'            => false,
                'notes'                => 'Dispositivo dimostrativo — non collegato a un RT reale.',
            ]
        );
    }
}
