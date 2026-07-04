<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Dish;
use App\Models\DishVariantGroup;
use App\Models\DishVariantOption;
use App\Models\Ingredient;
use App\Models\IngredientCategory;
use App\Models\Order;
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
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class DataImportService
{
    private const WINE_DEPARTMENTS = DataExportService::WINE_DEPARTMENTS;

    // id già "visti" durante questa run, per classe modello — usati per
    // calcolare gli orfani da eliminare in modalità "replace"
    private array $seen = [];

    public function importManifest(array $manifest, string $mode, array $groups, bool $dryRun): array
    {
        $registry = config('data_portability');

        if (($manifest['schema_version'] ?? null) !== $registry['schema_version']) {
            throw new \InvalidArgumentException(
                'Versione schema non compatibile (atteso v' . $registry['schema_version'] . ', trovato v' . ($manifest['schema_version'] ?? '?') . ')'
            );
        }

        $data   = $manifest['data'] ?? [];
        $groups = array_values(array_intersect($groups ?: array_keys($data), array_keys($data)));

        if ($mode === 'replace') {
            $this->guardReplaceSafety($groups);
        }

        $this->seen = [];
        $summary    = [];

        DB::beginTransaction();
        try {
            foreach ($registry['group_order'] as $slug) {
                if (! in_array($slug, $groups, true) || ! isset($data[$slug])) {
                    continue;
                }
                $summary[$slug] = $this->importGroup($slug, $data[$slug], $mode, $data);
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return ['mode' => $mode, 'dry_run' => $dryRun, 'groups' => $summary];
    }

    public function importCsv(string $entity, array $rows, bool $dryRun): array
    {
        $stat = $this->emptyStat();

        DB::beginTransaction();
        try {
            foreach ($rows as $row) {
                match ($entity) {
                    'dishes' => $this->importCsvDish($row, $stat),
                    'pizzas' => $this->importCsvPizza($row, $stat),
                    'wines'  => $this->importCsvWine($row, $stat),
                    default  => throw new \InvalidArgumentException("Entità CSV non supportata: {$entity}"),
                };
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return ['mode' => 'merge', 'dry_run' => $dryRun, 'groups' => [$entity => $stat]];
    }

    private function guardReplaceSafety(array $groups): void
    {
        $risky = array_intersect($groups, ['menu_cucina', 'menu_pizzeria', 'menu_vini', 'sala']);
        if ($risky && Order::where('status', 'open')->exists()) {
            throw new \RuntimeException(
                'Impossibile usare la modalità "Sostituisci" sui gruppi menu/sala mentre ci sono ordini aperti.'
            );
        }
    }

    private function importGroup(string $slug, array $data, string $mode, array $manifestData = []): array
    {
        return match ($slug) {
            'impostazioni'  => $this->importSettings($data),
            'menu_cucina'   => $this->importMenuCucina($data, $mode, $manifestData),
            'menu_pizzeria' => $this->importMenuPizzeria($data, $mode),
            'menu_vini'     => $this->importMenuVini($data, $mode),
            'sala'          => $this->importSala($data, $mode),
            'stampanti'     => $this->importPrinters($data, $mode),
            'utenti'        => $this->importUsers($data, $mode),
            default         => $this->emptyStat(),
        };
    }

    // ── Helpers generici ───────────────────────────────────────────────────

    private function emptyStat(): array
    {
        return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'deleted' => 0, 'conflicts' => 0, 'errors' => []];
    }

    /**
     * Upsert per chiave naturale. Se più righe corrispondono alla chiave
     * (es. tables ha perso il vincolo unique) la riga è marcata come
     * conflitto e saltata, invece di indovinare quale aggiornare.
     */
    private function upsertRow(string $modelClass, array $match, array $values, array &$stat): ?Model
    {
        $query = $modelClass::where($match);

        if ((clone $query)->count() > 1) {
            $stat['conflicts']++;
            $stat['errors'][] = 'Chiave ambigua: ' . json_encode($match, JSON_UNESCAPED_UNICODE);

            return null;
        }

        $model = $query->first() ?: new $modelClass();
        $isNew = ! $model->exists;
        $model->fill(array_merge($match, $values));
        $model->save();

        $isNew ? $stat['created']++ : ($model->wasChanged() ? $stat['updated']++ : $stat['unchanged']++);

        $this->seen[$modelClass][] = $model->id;

        return $model;
    }

    private function deleteUnseen(string $modelClass, array &$stat, ?\Closure $scope = null): void
    {
        $ids   = $this->seen[$modelClass] ?? [];
        $query = $modelClass::query();
        if ($scope) {
            $scope($query);
        }
        $stat['deleted'] += $query->whereNotIn('id', $ids ?: [0])->delete();
    }

    // ── impostazioni ────────────────────────────────────────────────────────

    private function importSettings(array $data): array
    {
        $stat = $this->emptyStat();

        foreach ($data['system_settings'] ?? [] as $row) {
            $this->upsertRow(SystemSetting::class, ['key' => $row['key']], ['value' => $row['value']], $stat);
        }

        foreach ($data['service_schedule'] ?? [] as $row) {
            $this->upsertRow(
                ServiceSchedule::class,
                ['department' => $row['department'], 'day_of_week' => $row['day_of_week']],
                ['is_active' => (bool) ($row['is_active'] ?? true)],
                $stat
            );
        }

        // Le impostazioni non vengono mai eliminate in "replace" — sono chiavi
        // fisse usate dall'app, non un elenco arbitrario.
        return $stat;
    }

    // ── menu_cucina ─────────────────────────────────────────────────────────

    private function importMenuCucina(array $data, string $mode, array $manifestData = []): array
    {
        $stat = $this->emptyStat();

        foreach ($data['ingredient_categories'] ?? [] as $row) {
            $this->upsertRow(IngredientCategory::class, ['name' => $row['name']], [
                'department' => $row['department'] ?? 'cucina',
                'sort_order' => $row['sort_order'] ?? 0,
                'is_active'  => (bool) ($row['is_active'] ?? true),
            ], $stat);
        }

        foreach ($data['ingredients'] ?? [] as $row) {
            $categoryId = ! empty($row['category'])
                ? IngredientCategory::where('name', $row['category'])->value('id')
                : null;

            $this->upsertRow(Ingredient::class, ['name' => $row['name']], [
                'department'             => $row['department'] ?? 'cucina',
                'price_add'              => $row['price_add'] ?? 0,
                'price_remove'           => $row['price_remove'] ?? 0,
                'is_active'              => (bool) ($row['is_active'] ?? true),
                'ingredient_category_id' => $categoryId,
            ], $stat);
        }

        foreach ($data['categories'] ?? [] as $row) {
            $this->upsertRow(Category::class, ['name' => $row['name'], 'department' => $row['department']], [
                'sort_order' => $row['sort_order'] ?? 0,
                'is_active'  => (bool) ($row['is_active'] ?? true),
            ], $stat);
        }

        foreach ($data['dish_variant_groups'] ?? [] as $row) {
            $group = $this->upsertRow(DishVariantGroup::class, ['name' => $row['name']], [
                'department'  => $row['department'] ?? 'cucina',
                'is_required' => (bool) ($row['is_required'] ?? false),
                'is_active'   => (bool) ($row['is_active'] ?? true),
                'sort_order'  => $row['sort_order'] ?? 0,
            ], $stat);

            foreach ($row['options'] ?? [] as $opt) {
                if (! $group) {
                    continue;
                }
                $this->upsertRow(DishVariantOption::class, [
                    'dish_variant_group_id' => $group->id,
                    'name'                  => $opt['name'],
                ], [
                    'price_add'  => $opt['price_add'] ?? 0,
                    'is_active'  => (bool) ($opt['is_active'] ?? true),
                    'sort_order' => $opt['sort_order'] ?? 0,
                ], $stat);
            }
        }

        foreach ($data['dishes'] ?? [] as $row) {
            // Non si filtra per department: un piatto può referenziare anche una
            // categoria del "bucket" vini (es. vino della casa venduto come piatto)
            $categoryId = Category::where('name', $row['category'] ?? '')->value('id');

            // Le categorie "vino" (dip. carta_vini/vini_casa) vivono nel gruppo
            // menu_vini, importato DOPO menu_cucina. Se un piatto le referenzia,
            // creale al volo con i metadati corretti presi dal manifest, così non
            // vanno perse per via dell'ordine di import (né si creano duplicati:
            // il match name+department combacia con l'upsert di menu_vini).
            if (! $categoryId) {
                $wineCat = collect($manifestData['menu_vini']['wine_categories'] ?? [])
                    ->first(fn ($c) => ($c['name'] ?? null) === ($row['category'] ?? null));

                if ($wineCat) {
                    $cat = $this->upsertRow(
                        Category::class,
                        ['name' => $wineCat['name'], 'department' => $wineCat['department']],
                        ['sort_order' => $wineCat['sort_order'] ?? 0, 'is_active' => (bool) ($wineCat['is_active'] ?? true)],
                        $stat
                    );
                    $categoryId = $cat?->id;
                }
            }

            if (! $categoryId) {
                $stat['conflicts']++;
                $stat['errors'][] = "Piatto '{$row['name']}': categoria '{$row['category']}' non trovata";
                continue;
            }

            $dish = $this->upsertRow(Dish::class, ['name' => $row['name'], 'category_id' => $categoryId], [
                'description' => $row['description'] ?? null,
                'price'       => $row['price'] ?? 0,
                'is_active'   => (bool) ($row['is_active'] ?? true),
            ], $stat);

            if (! $dish) {
                continue;
            }

            $pivot = [];
            foreach ($row['ingredients'] ?? [] as $ing) {
                $id = Ingredient::where('name', $ing['name'])->value('id');
                if ($id) {
                    $pivot[$id] = ['is_default' => (bool) ($ing['is_default'] ?? true)];
                }
            }
            $dish->ingredients()->sync($pivot);

            $groupIds = DishVariantGroup::whereIn('name', $row['variant_groups'] ?? [])->pluck('id')->all();
            $dish->variantGroups()->sync($groupIds);
        }

        if ($mode === 'replace') {
            $this->deleteUnseen(Dish::class, $stat);
            $this->deleteUnseen(DishVariantOption::class, $stat);
            $this->deleteUnseen(DishVariantGroup::class, $stat);
            $this->deleteUnseen(Ingredient::class, $stat);
            $this->deleteUnseen(IngredientCategory::class, $stat);
            $this->deleteUnseen(Category::class, $stat, fn ($q) => $q->whereNotIn('department', self::WINE_DEPARTMENTS));
        }

        return $stat;
    }

    // ── menu_pizzeria ───────────────────────────────────────────────────────

    private function importMenuPizzeria(array $data, string $mode): array
    {
        $stat = $this->emptyStat();

        foreach ($data['pizza_ingredients'] ?? [] as $row) {
            $this->upsertRow(PizzaIngredient::class, ['name' => $row['name']], [
                'price_add'    => $row['price_add'] ?? 0,
                'price_remove' => $row['price_remove'] ?? 0,
                'is_active'    => (bool) ($row['is_active'] ?? true),
            ], $stat);
        }

        foreach ($data['pizza_variants'] ?? [] as $row) {
            $this->upsertRow(PizzaVariant::class, ['code' => $row['code']], [
                'name'      => $row['name'],
                'price_add' => $row['price_add'] ?? 0,
                'is_active' => (bool) ($row['is_active'] ?? true),
            ], $stat);
        }

        foreach ($data['pizzas'] ?? [] as $row) {
            $pizza = $this->upsertRow(Pizza::class, ['name' => $row['name']], [
                'description'  => $row['description'] ?? null,
                'base_price'   => $row['base_price'] ?? 0,
                'default_base' => $row['default_base'] ?? null,
                'is_active'    => (bool) ($row['is_active'] ?? true),
            ], $stat);

            if (! $pizza) {
                continue;
            }

            $ids = PizzaIngredient::whereIn('name', $row['default_ingredients'] ?? [])->pluck('id')->all();
            $pizza->defaultIngredients()->sync($ids);
        }

        if ($mode === 'replace') {
            $this->deleteUnseen(Pizza::class, $stat);
            $this->deleteUnseen(PizzaIngredient::class, $stat);
            $this->deleteUnseen(PizzaVariant::class, $stat);
        }

        return $stat;
    }

    // ── menu_vini ───────────────────────────────────────────────────────────

    private function importMenuVini(array $data, string $mode): array
    {
        $stat = $this->emptyStat();

        foreach ($data['wine_categories'] ?? [] as $row) {
            $this->upsertRow(Category::class, ['name' => $row['name'], 'department' => $row['department']], [
                'sort_order' => $row['sort_order'] ?? 0,
                'is_active'  => (bool) ($row['is_active'] ?? true),
            ], $stat);
        }

        foreach ($data['wine_quantities'] ?? [] as $row) {
            $this->upsertRow(WineQuantity::class, ['name' => $row['name']], [
                'price_add'  => $row['price_add'] ?? 0,
                'sort_order' => $row['sort_order'] ?? 0,
                'is_active'  => (bool) ($row['is_active'] ?? true),
            ], $stat);
        }

        foreach ($data['wines'] ?? [] as $row) {
            $categoryId = Category::where('name', $row['category'] ?? '')->value('id');

            if (! $categoryId) {
                $stat['conflicts']++;
                $stat['errors'][] = "Vino '{$row['name']}': categoria '{$row['category']}' non trovata";
                continue;
            }

            $wine = $this->upsertRow(Wine::class, ['name' => $row['name'], 'category_id' => $categoryId], [
                'producer'     => $row['producer'] ?? null,
                'vintage_year' => $row['vintage_year'] ?? null,
                'price'        => $row['price'] ?? 0,
                'description'  => $row['description'] ?? null,
                'is_active'    => (bool) ($row['is_active'] ?? true),
            ], $stat);

            if (! $wine) {
                continue;
            }

            $groupIds = DishVariantGroup::whereIn('name', $row['variant_groups'] ?? [])->pluck('id')->all();
            $wine->variantGroups()->sync($groupIds);
        }

        if ($mode === 'replace') {
            $this->deleteUnseen(Wine::class, $stat);
            $this->deleteUnseen(Category::class, $stat, fn ($q) => $q->whereIn('department', self::WINE_DEPARTMENTS));
            $this->deleteUnseen(WineQuantity::class, $stat);
        }

        return $stat;
    }

    // ── sala ────────────────────────────────────────────────────────────────

    private function importSala(array $data, string $mode): array
    {
        $stat = $this->emptyStat();

        foreach ($data['zones'] ?? [] as $row) {
            $this->upsertRow(Zone::class, ['name' => $row['name']], [
                'is_outdoor' => (bool) ($row['is_outdoor'] ?? false),
                'is_enabled' => (bool) ($row['is_enabled'] ?? true),
                'sort_order' => $row['sort_order'] ?? 0,
            ], $stat);
        }

        $tableRows = $data['tables'] ?? [];
        $resolved  = [];

        // Prima passata: crea/aggiorna i tavoli senza il legame parent
        foreach ($tableRows as $i => $row) {
            $zoneId = Zone::where('name', $row['zone'] ?? '')->value('id');
            if (! $zoneId) {
                $stat['conflicts']++;
                $stat['errors'][] = "Tavolo {$row['number']}: zona '{$row['zone']}' non trovata";
                continue;
            }

            $resolved[$i] = $this->upsertRow(Table::class, [
                'zone_id' => $zoneId, 'number' => $row['number'], 'suffix' => $row['suffix'] ?? null,
            ], [
                'status' => $row['status'] ?? 'libero',
            ], $stat);
        }

        // Seconda passata: collega i tavoli bis/tris al loro principale
        foreach ($tableRows as $i => $row) {
            if (empty($row['parent']) || empty($resolved[$i])) {
                continue;
            }
            $zoneId   = Zone::where('name', $row['zone'])->value('id');
            $parentId = Table::where('zone_id', $zoneId)
                ->where('number', $row['parent']['number'])
                ->where('suffix', $row['parent']['suffix'] ?? null)
                ->value('id');

            if ($parentId) {
                $resolved[$i]->update(['parent_table_id' => $parentId]);
            }
        }

        if ($mode === 'replace') {
            $this->deleteUnseen(Table::class, $stat);
            $this->deleteUnseen(Zone::class, $stat);
        }

        return $stat;
    }

    // ── stampanti ───────────────────────────────────────────────────────────

    private function importPrinters(array $data, string $mode): array
    {
        $stat = $this->emptyStat();

        foreach ($data['printers'] ?? [] as $row) {
            $this->upsertRow(Printer::class, ['name' => $row['name']], [
                'department' => $row['department'],
                'ip_address' => $row['ip_address'],
                'port'       => $row['port'] ?? 9100,
                'is_active'  => (bool) ($row['is_active'] ?? true),
            ], $stat);
        }

        if ($mode === 'replace') {
            $this->deleteUnseen(Printer::class, $stat);
        }

        return $stat;
    }

    // ── utenti ──────────────────────────────────────────────────────────────

    private function importUsers(array $data, string $mode): array
    {
        $stat      = $this->emptyStat();
        $currentId = auth()->id();

        foreach ($data['users'] ?? [] as $row) {
            $existing = User::where('username', $row['username'])->first();

            // L'utente attualmente connesso non viene mai toccato, per evitare
            // di auto-escludersi/bloccarsi a metà importazione.
            if ($existing && $existing->id === $currentId) {
                $stat['unchanged']++;
                $stat['errors'][] = "Utente '{$row['username']}': saltato (è l'utente attualmente connesso)";
                $this->seen[User::class][] = $existing->id;
                continue;
            }

            $this->upsertRow(User::class, ['username' => $row['username']], [
                'name'          => $row['name'],
                'surname'       => $row['surname'],
                'password_hash' => $row['password_hash'],
                'role'          => $row['role'],
                'pin'           => $row['pin'],
                'status'        => $row['status'] ?? 'active',
            ], $stat);
        }

        if ($mode === 'replace') {
            $this->seen[User::class][] = $currentId;
            $this->deleteUnseen(User::class, $stat);
        }

        return $stat;
    }

    // ── CSV (modifica massiva, solo aggiornamento campi piatti) ──────────────

    // fgetcsv restituisce '' per le celle vuote, non null: senza questa
    // normalizzazione ogni riga con un campo nullable vuoto risulterebbe
    // sempre "aggiornata" anche a parità di contenuto.
    private function csvNullable(array $row, string $key, mixed $current): mixed
    {
        if (! array_key_exists($key, $row) || $row[$key] === null) {
            return $current;
        }

        return $row[$key] === '' ? null : $row[$key];
    }

    private function importCsvDish(array $row, array &$stat): void
    {
        $query = ! empty($row['id']) ? Dish::where('id', $row['id']) : null;

        if (! $query) {
            $categoryId = Category::where('name', $row['category'] ?? '')->value('id');
            if (! $categoryId) {
                $stat['conflicts']++;
                $stat['errors'][] = "Riga '{$row['name']}': categoria non trovata";
                return;
            }
            $query = Dish::where('name', $row['name'])->where('category_id', $categoryId);
        }

        if ((clone $query)->count() > 1) {
            $stat['conflicts']++;
            $stat['errors'][] = "Riga '{$row['name']}': più piatti corrispondenti";
            return;
        }

        $dish = $query->first();
        if (! $dish) {
            $stat['conflicts']++;
            $stat['errors'][] = "Riga '{$row['name']}': piatto non trovato";
            return;
        }

        $dish->fill([
            'name'        => $row['name'] !== '' ? $row['name'] : $dish->name,
            'description' => $this->csvNullable($row, 'description', $dish->description),
            'price'       => $row['price'] ?? $dish->price,
            'is_active'   => isset($row['is_active']) ? (bool) (int) $row['is_active'] : $dish->is_active,
        ]);
        $dish->save();
        $stat[$dish->wasChanged() ? 'updated' : 'unchanged']++;
    }

    private function importCsvPizza(array $row, array &$stat): void
    {
        $query = ! empty($row['id']) ? Pizza::where('id', $row['id']) : Pizza::where('name', $row['name']);

        if ((clone $query)->count() > 1) {
            $stat['conflicts']++;
            $stat['errors'][] = "Riga '{$row['name']}': più pizze corrispondenti";
            return;
        }

        $pizza = $query->first();
        if (! $pizza) {
            $stat['conflicts']++;
            $stat['errors'][] = "Riga '{$row['name']}': pizza non trovata";
            return;
        }

        $pizza->fill([
            'name'        => $row['name'] !== '' ? $row['name'] : $pizza->name,
            'description' => $this->csvNullable($row, 'description', $pizza->description),
            'base_price'  => $row['price'] ?? $pizza->base_price,
            'is_active'   => isset($row['is_active']) ? (bool) (int) $row['is_active'] : $pizza->is_active,
        ]);
        $pizza->save();
        $stat[$pizza->wasChanged() ? 'updated' : 'unchanged']++;
    }

    private function importCsvWine(array $row, array &$stat): void
    {
        $query = ! empty($row['id']) ? Wine::where('id', $row['id']) : null;

        if (! $query) {
            $categoryId = Category::where('name', $row['category'] ?? '')->value('id');
            if (! $categoryId) {
                $stat['conflicts']++;
                $stat['errors'][] = "Riga '{$row['name']}': categoria non trovata";
                return;
            }
            $query = Wine::where('name', $row['name'])->where('category_id', $categoryId);
        }

        if ((clone $query)->count() > 1) {
            $stat['conflicts']++;
            $stat['errors'][] = "Riga '{$row['name']}': più vini corrispondenti";
            return;
        }

        $wine = $query->first();
        if (! $wine) {
            $stat['conflicts']++;
            $stat['errors'][] = "Riga '{$row['name']}': vino non trovato";
            return;
        }

        $wine->fill([
            'name'         => $row['name'] !== '' ? $row['name'] : $wine->name,
            'producer'     => $this->csvNullable($row, 'producer', $wine->producer),
            'vintage_year' => $this->csvNullable($row, 'vintage_year', $wine->vintage_year),
            'description'  => $this->csvNullable($row, 'description', $wine->description),
            'price'        => $row['price'] ?? $wine->price,
            'is_active'    => isset($row['is_active']) ? (bool) (int) $row['is_active'] : $wine->is_active,
        ]);
        $wine->save();
        $stat[$wine->wasChanged() ? 'updated' : 'unchanged']++;
    }
}
