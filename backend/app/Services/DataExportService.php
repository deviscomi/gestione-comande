<?php

namespace App\Services;

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

class DataExportService
{
    // Le categorie con questi department appartengono al gruppo "menu_vini",
    // tutte le altre al gruppo "menu_cucina" (la tabella categories è condivisa).
    public const WINE_DEPARTMENTS = ['carta_vini', 'vini_casa'];

    public function buildManifest(array $groups): array
    {
        $registry = config('data_portability');
        $data     = [];
        $counts   = [];

        foreach ($groups as $slug) {
            if (! isset($registry['groups'][$slug])) {
                continue;
            }
            $payload         = $this->buildGroup($slug);
            $data[$slug]     = $payload;
            $counts[$slug]   = array_map('count', $payload);
        }

        return [
            'app'            => 'gestione-comande',
            'schema_version' => $registry['schema_version'],
            'exported_at'    => now()->toIso8601String(),
            'app_version'    => config('app.version', '1.0'),
            'groups'         => array_keys($data),
            'counts'         => $counts,
            'data'           => $data,
            'checksum'       => $this->checksum($data),
        ];
    }

    private function checksum(array $data): string
    {
        return hash('sha256', json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function buildGroup(string $slug): array
    {
        return match ($slug) {
            'impostazioni'  => $this->buildSettings(),
            'menu_cucina'   => $this->buildMenuCucina(),
            'menu_pizzeria' => $this->buildMenuPizzeria(),
            'menu_vini'     => $this->buildMenuVini(),
            'sala'          => $this->buildSala(),
            'stampanti'     => $this->buildPrinters(),
            'utenti'        => $this->buildUsers(),
            default         => [],
        };
    }

    private function buildSettings(): array
    {
        return [
            'system_settings' => SystemSetting::orderBy('key')->get(['key', 'value'])
                ->map(fn ($s) => ['key' => $s->key, 'value' => $s->value])->all(),

            'service_schedule' => ServiceSchedule::orderBy('department')->orderBy('day_of_week')->get()
                ->map(fn ($s) => [
                    'department'  => $s->department,
                    'day_of_week' => $s->day_of_week,
                    'is_active'   => (bool) $s->is_active,
                ])->all(),
        ];
    }

    private function buildMenuCucina(): array
    {
        $ingredientCategories = IngredientCategory::orderBy('name')->get();
        $ingredients          = Ingredient::with('category')->orderBy('name')->get();
        $categories           = Category::whereNotIn('department', self::WINE_DEPARTMENTS)->orderBy('name')->get();
        $variantGroups        = DishVariantGroup::with('options')->orderBy('name')->get();
        $dishes               = Dish::with(['category', 'ingredients', 'variantGroups'])->orderBy('name')->get();

        return [
            'ingredient_categories' => $ingredientCategories->map(fn ($c) => [
                'name'       => $c->name,
                'department' => $c->department,
                'sort_order' => $c->sort_order,
                'is_active'  => (bool) $c->is_active,
            ])->all(),

            'ingredients' => $ingredients->map(fn ($i) => [
                'name'         => $i->name,
                'department'   => $i->department,
                'price_add'    => $this->money($i->price_add),
                'price_remove' => $this->money($i->price_remove),
                'is_active'    => (bool) $i->is_active,
                'category'     => $i->category?->name,
            ])->all(),

            'categories' => $categories->map(fn ($c) => [
                'name'       => $c->name,
                'department' => $c->department,
                'sort_order' => $c->sort_order,
                'is_active'  => (bool) $c->is_active,
            ])->all(),

            'dish_variant_groups' => $variantGroups->map(fn ($g) => [
                'name'        => $g->name,
                'department'  => $g->department,
                'is_required' => (bool) $g->is_required,
                'is_active'   => (bool) $g->is_active,
                'sort_order'  => $g->sort_order,
                'options'     => $g->options->map(fn ($o) => [
                    'name'       => $o->name,
                    'price_add'  => $this->money($o->price_add),
                    'is_active'  => (bool) $o->is_active,
                    'sort_order' => $o->sort_order,
                ])->all(),
            ])->all(),

            'dishes' => $dishes->map(fn ($d) => [
                'name'           => $d->name,
                'description'    => $d->description,
                'price'          => $this->money($d->price),
                'is_active'      => (bool) $d->is_active,
                'category'       => $d->category?->name,
                'ingredients'    => $d->ingredients->map(fn ($i) => [
                    'name'       => $i->name,
                    'is_default' => (bool) $i->pivot->is_default,
                ])->all(),
                'variant_groups' => $d->variantGroups->pluck('name')->all(),
            ])->all(),
        ];
    }

    private function buildMenuPizzeria(): array
    {
        $pizzaIngredients = PizzaIngredient::orderBy('name')->get();
        $pizzaVariants    = PizzaVariant::orderBy('name')->get();
        $pizzas           = Pizza::with('defaultIngredients')->orderBy('name')->get();

        return [
            'pizza_ingredients' => $pizzaIngredients->map(fn ($i) => [
                'name'         => $i->name,
                'price_add'    => $this->money($i->price_add),
                'price_remove' => $this->money($i->price_remove),
                'is_active'    => (bool) $i->is_active,
            ])->all(),

            'pizza_variants' => $pizzaVariants->map(fn ($v) => [
                'name'      => $v->name,
                'code'      => $v->code,
                'price_add' => $this->money($v->price_add),
                'is_active' => (bool) $v->is_active,
            ])->all(),

            'pizzas' => $pizzas->map(fn ($p) => [
                'name'                => $p->name,
                'description'         => $p->description,
                'base_price'          => $this->money($p->base_price),
                'default_base'        => $p->default_base,
                'is_active'           => (bool) $p->is_active,
                'default_ingredients' => $p->defaultIngredients->pluck('name')->all(),
            ])->all(),
        ];
    }

    private function buildMenuVini(): array
    {
        $wines      = Wine::with(['category', 'variantGroups'])->orderBy('name')->get();
        $quantities = WineQuantity::orderBy('sort_order')->get();
        $categories = Category::whereIn('department', self::WINE_DEPARTMENTS)->orderBy('name')->get();

        return [
            'wine_categories' => $categories->map(fn ($c) => [
                'name'       => $c->name,
                'department' => $c->department,
                'sort_order' => $c->sort_order,
                'is_active'  => (bool) $c->is_active,
            ])->all(),

            'wines' => $wines->map(fn ($w) => [
                'name'           => $w->name,
                'producer'       => $w->producer,
                'vintage_year'   => $w->vintage_year,
                'price'          => $this->money($w->price),
                'description'    => $w->description,
                'is_active'      => (bool) $w->is_active,
                'category'       => $w->category?->name,
                'variant_groups' => $w->variantGroups->pluck('name')->all(),
            ])->all(),

            'wine_quantities' => $quantities->map(fn ($q) => [
                'name'       => $q->name,
                'price_add'  => $this->money($q->price_add),
                'sort_order' => $q->sort_order,
                'is_active'  => (bool) $q->is_active,
            ])->all(),
        ];
    }

    private function buildSala(): array
    {
        $zones  = Zone::orderBy('sort_order')->get();
        $tables = Table::with(['zone', 'parent'])->orderByRaw('parent_table_id IS NOT NULL')->orderBy('number')->get();

        return [
            'zones' => $zones->map(fn ($z) => [
                'name'       => $z->name,
                'is_outdoor' => (bool) $z->is_outdoor,
                'is_enabled' => (bool) $z->is_enabled,
                'sort_order' => $z->sort_order,
            ])->all(),

            'tables' => $tables->map(fn ($t) => [
                'zone'   => $t->zone?->name,
                'number' => $t->number,
                'suffix' => $t->suffix,
                'status' => $t->status,
                'parent' => $t->parent ? ['number' => $t->parent->number, 'suffix' => $t->parent->suffix] : null,
            ])->all(),
        ];
    }

    private function buildPrinters(): array
    {
        return [
            'printers' => Printer::orderBy('name')->get()->map(fn ($p) => [
                'name'       => $p->name,
                'department' => $p->department,
                'ip_address' => $p->ip_address,
                'port'       => $p->port,
                'is_active'  => (bool) $p->is_active,
            ])->all(),
        ];
    }

    private function buildUsers(): array
    {
        return [
            'users' => User::orderBy('username')->get()->map(fn ($u) => [
                'name'          => $u->name,
                'surname'       => $u->surname,
                'username'      => $u->username,
                'password_hash' => $u->password_hash,
                'role'          => $u->role,
                'pin'           => $u->pin,
                'status'        => $u->status,
            ])->all(),
        ];
    }

    private function money(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    public function exportCsv(string $entity): string
    {
        return match ($entity) {
            'dishes' => $this->csvDishes(),
            'pizzas' => $this->csvPizzas(),
            'wines'  => $this->csvWines(),
            default  => throw new \InvalidArgumentException("Entità CSV non supportata: {$entity}"),
        };
    }

    private function csvDishes(): string
    {
        $header = ['id', 'name', 'category', 'description', 'price', 'is_active'];
        $rows   = Dish::with('category')->orderBy('name')->get()->map(fn ($d) => [
            $d->id, $d->name, $d->category?->name, $d->description, $this->money($d->price), $d->is_active ? 1 : 0,
        ])->all();

        return $this->toCsv($header, $rows);
    }

    private function csvPizzas(): string
    {
        $header = ['id', 'name', 'description', 'price', 'is_active'];
        $rows   = Pizza::orderBy('name')->get()->map(fn ($p) => [
            $p->id, $p->name, $p->description, $this->money($p->base_price), $p->is_active ? 1 : 0,
        ])->all();

        return $this->toCsv($header, $rows);
    }

    private function csvWines(): string
    {
        $header = ['id', 'name', 'category', 'producer', 'vintage_year', 'description', 'price', 'is_active'];
        $rows   = Wine::with('category')->orderBy('name')->get()->map(fn ($w) => [
            $w->id, $w->name, $w->category?->name, $w->producer, $w->vintage_year, $w->description, $this->money($w->price), $w->is_active ? 1 : 0,
        ])->all();

        return $this->toCsv($header, $rows);
    }

    // Delimitatore ';' per compatibilità con Excel in locale italiana (',' è separatore decimale)
    private function toCsv(array $header, array $rows): string
    {
        $fh = fopen('php://temp', 'r+');
        fwrite($fh, "\xEF\xBB\xBF");
        fputcsv($fh, $header, ';');
        foreach ($rows as $row) {
            fputcsv($fh, $row, ';');
        }
        rewind($fh);
        $content = stream_get_contents($fh);
        fclose($fh);

        return $content;
    }
}
