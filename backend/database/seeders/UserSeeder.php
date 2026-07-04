<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Un utente per ruolo, così il demo è provabile da ogni angolazione.
        // Idempotente su 'username'. Login web: username+password; tablet: PIN.
        $users = [
            ['name' => 'Admin',   'surname' => 'Sistema',  'username' => 'admin',   'password' => 'admin123',   'role' => 'super_admin', 'pin' => '0000'],
            ['name' => 'Marco',   'surname' => 'Bianchi',  'username' => 'manager', 'password' => 'manager123', 'role' => 'admin',       'pin' => '1111'],
            ['name' => 'Carla',   'surname' => 'Verdi',    'username' => 'cassa',   'password' => 'cassa123',   'role' => 'cashier',     'pin' => '2222'],
            ['name' => 'Mario',   'surname' => 'Rossi',    'username' => 'mario',   'password' => 'mario123',   'role' => 'waiter',      'pin' => '1234'],
            ['name' => 'Luigi',   'surname' => 'Esposito', 'username' => 'luigi',   'password' => 'luigi123',   'role' => 'waiter',      'pin' => '4321'],
        ];

        foreach ($users as $u) {
            User::firstOrCreate(
                ['username' => $u['username']],
                [
                    'name'          => $u['name'],
                    'surname'       => $u['surname'],
                    'password_hash' => Hash::make($u['password']),
                    'role'          => $u['role'],
                    'pin'           => $u['pin'],
                    'status'        => 'active',
                ]
            );
        }
    }
}
