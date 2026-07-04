<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Dish;
use App\Models\DishVariantGroup;
use App\Models\Ingredient;
use App\Models\IngredientCategory;
use App\Models\Pizza;
use App\Models\PizzaIngredient;
use App\Models\PizzaVariant;
use App\Models\Printer;
use App\Models\ServiceSchedule;
use App\Models\SystemSetting;
use App\Models\Table;
use App\Models\User;
use App\Models\Wine;
use App\Models\WineQuantity;
use App\Models\Zone;
use App\Services\DataExportService;
use App\Services\DataImportService;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class DataPortabilityController extends Controller
{
    use LogsActivity;

    public function __construct(
        private DataExportService $exportService,
        private DataImportService $importService,
    ) {}

    public function groups(): JsonResponse
    {
        $registry = config('data_portability');

        $counts = [
            'impostazioni'  => SystemSetting::count() + ServiceSchedule::count(),
            'menu_cucina'   => Dish::count() + Ingredient::count() + IngredientCategory::count()
                + Category::whereNotIn('department', DataExportService::WINE_DEPARTMENTS)->count()
                + DishVariantGroup::count(),
            'menu_pizzeria' => Pizza::count() + PizzaIngredient::count() + PizzaVariant::count(),
            'menu_vini'     => Wine::count() + WineQuantity::count()
                + Category::whereIn('department', DataExportService::WINE_DEPARTMENTS)->count(),
            'sala'          => Zone::count() + Table::count(),
            'stampanti'     => Printer::count(),
            'utenti'        => User::count(),
        ];

        $groups = collect($registry['groups'])->map(fn ($meta, $slug) => [
            'slug'      => $slug,
            'label'     => $meta['label'],
            'sensitive' => $meta['sensitive'],
            'count'     => $counts[$slug] ?? 0,
        ])->values();

        return response()->json([
            'groups'         => $groups,
            'schema_version' => $registry['schema_version'],
            'csv_entities'   => $registry['csv_entities'],
        ]);
    }

    public function export(Request $request)
    {
        $request->validate([
            'format'   => 'required|in:json,csv',
            'groups'   => 'required_if:format,json|array',
            'groups.*' => 'string',
            'entity'   => 'required_if:format,csv|in:dishes,pizzas,wines',
        ]);

        if ($request->format === 'csv') {
            $entity  = $request->string('entity')->toString();
            $content = $this->exportService->exportCsv($entity);

            $this->logActivity('DATA_EXPORTED', "Esportazione CSV: {$entity}");

            return response($content, 200, [
                'Content-Type'        => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="' . $entity . '-' . now()->format('Y-m-d') . '.csv"',
            ]);
        }

        $groups   = $request->input('groups', []);
        $manifest = $this->exportService->buildManifest($groups);

        $this->logActivity('DATA_EXPORTED', 'Esportazione JSON gruppi: ' . implode(', ', $manifest['groups']));

        return response(json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 200, [
            'Content-Type'        => 'application/json',
            'Content-Disposition' => 'attachment; filename="backup-config-' . now()->format('Y-m-d') . '.json"',
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        return $this->handleImport($request, dryRun: true);
    }

    public function import(Request $request): JsonResponse
    {
        return $this->handleImport($request, dryRun: false);
    }

    private function handleImport(Request $request, bool $dryRun): JsonResponse
    {
        $request->validate([
            'file'     => 'required|file',
            'mode'     => 'required|in:merge,replace',
            'groups'   => 'array',
            'groups.*' => 'string',
            'entity'   => 'nullable|in:dishes,pizzas,wines',
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $ext  = strtolower($file->getClientOriginalExtension());

        try {
            if ($ext === 'csv' || $request->filled('entity')) {
                $entity = $request->input('entity');
                if (! $entity) {
                    throw new \InvalidArgumentException('Entità CSV non specificata');
                }
                $rows   = $this->parseCsv($file->getRealPath());
                $result = $this->importService->importCsv($entity, $rows, $dryRun);
            } else {
                $manifest = json_decode((string) file_get_contents($file->getRealPath()), true);
                if (! is_array($manifest)) {
                    throw new \InvalidArgumentException('File JSON non valido o non leggibile');
                }
                $groups = $request->input('groups', $manifest['groups'] ?? []);
                $result = $this->importService->importManifest($manifest, $request->string('mode')->toString(), $groups, $dryRun);
            }
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Importazione fallita: ' . $e->getMessage()], 422);
        }

        if (! $dryRun) {
            $counts = collect($result['groups'])->map(fn ($s, $g) => "{$g}: +{$s['created']}/~{$s['updated']}/-{$s['deleted']}")->implode(', ');
            $this->logActivity('DATA_IMPORTED', "Import dati ({$result['mode']}): {$counts}");
        }

        return response()->json($result);
    }

    private function parseCsv(string $path): array
    {
        $fh  = fopen($path, 'r');
        $bom = fread($fh, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($fh);
        }

        $header = fgetcsv($fh, 0, ';');
        $rows   = [];
        while (($line = fgetcsv($fh, 0, ';')) !== false) {
            if (count($line) === 1 && $line[0] === null) {
                continue;
            }
            $rows[] = array_combine($header, array_pad($line, count($header), null));
        }
        fclose($fh);

        return $rows;
    }
}
