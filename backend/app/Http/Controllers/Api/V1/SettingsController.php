<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    use LogsActivity;

    public function show(string $key): JsonResponse
    {
        $setting = SystemSetting::where('key', $key)->firstOrFail();
        return response()->json(['key' => $setting->key, 'value' => $setting->value]);
    }

    public function index(): JsonResponse
    {
        $settings = SystemSetting::all()->pluck('value', 'key');
        return response()->json($settings);
    }

    public function bulkUpdate(Request $request): JsonResponse
    {
        $request->validate([
            '*.key'   => 'required|string|max:100',
            '*.value' => 'required|string',
        ]);

        $updated = [];
        foreach ($request->all() as $item) {
            $setting   = SystemSetting::updateOrCreate(['key' => $item['key']], ['value' => $item['value']]);
            $updated[] = ['key' => $setting->key, 'value' => $setting->value];
        }

        $keys = implode(', ', array_column($updated, 'key'));
        $this->logActivity('SETTINGS_UPDATED', "Impostazioni aggiornate: {$keys}");

        return response()->json($updated);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $request->validate(['value' => 'required|string']);
        $setting = SystemSetting::updateOrCreate(['key' => $key], ['value' => $request->value]);
        $this->logActivity('SETTING_UPDATED', "Impostazione '{$key}' aggiornata");
        return response()->json(['key' => $setting->key, 'value' => $setting->value]);
    }
}
