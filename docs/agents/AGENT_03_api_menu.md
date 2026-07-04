# AGENT 03 — API Backend: Menu (Cucina & Pizzeria)

**Dipendenze:** AGENT_01 + AGENT_02 completati.
**Output atteso:** CRUD completo per categorie, piatti, ingredienti cucina, pizze, ingredienti pizzeria, varianti pizza.

---

## Obiettivo

Implementare tutti gli endpoint del menu con logica di business, validazione Form Requests e API Resources.
Tutti i GET sono accessibili a entrambi i ruoli. POST/PUT/DELETE/PATCH richiedono `role:admin`.

---

## Controllers da creare in `app/Http/Controllers/Api/V1/`

```
CategoryController.php
DishController.php
IngredientController.php
PizzaController.php
PizzaIngredientController.php
PizzaVariantController.php
```

---

## Registrazione route in `routes/api.php`

```php
// Menu — Cucina (dentro il gruppo auth:sanctum)
Route::apiResource('categories', CategoryController::class);
Route::patch('categories/{category}/toggle', [CategoryController::class, 'toggle']);

Route::apiResource('dishes', DishController::class);
Route::patch('dishes/{dish}/toggle', [DishController::class, 'toggle']);

Route::apiResource('ingredients', IngredientController::class);
Route::patch('ingredients/{ingredient}/toggle', [IngredientController::class, 'toggle']);

// Menu — Pizzeria
Route::apiResource('pizzas', PizzaController::class);
Route::patch('pizzas/{pizza}/toggle', [PizzaController::class, 'toggle']);

Route::apiResource('pizza-ingredients', PizzaIngredientController::class);
Route::patch('pizza-ingredients/{pizzaIngredient}/toggle', [PizzaIngredientController::class, 'toggle']);

Route::apiResource('pizza-variants', PizzaVariantController::class);
Route::patch('pizza-variants/{pizzaVariant}/toggle', [PizzaVariantController::class, 'toggle']);
```

---

## CategoryController

```php
public function index(Request $request) {
    $q = Category::query();
    if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
    if ($request->has('department')) $q->where('department', $request->department);
    return CategoryResource::collection($q->orderBy('sort_order')->get());
}

public function store(StoreCategoryRequest $request) {
    $category = Category::create($request->validated());
    $this->logActivity('CATEGORY_CREATED', "Categoria '{$category->name}' creata", $category);
    return new CategoryResource($category);
}

public function update(UpdateCategoryRequest $request, Category $category) {
    $category->update($request->validated());
    return new CategoryResource($category);
}

public function destroy(Category $category) {
    if ($category->dishes()->exists()) {
        return response()->json(['message' => 'Impossibile eliminare: categoria con piatti associati'], 422);
    }
    $category->delete();
    return response()->noContent();
}

public function toggle(Category $category) {
    $category->update(['is_active' => !$category->is_active]);
    return new CategoryResource($category);
}
```

---

## DishController

```php
public function index(Request $request) {
    $q = Dish::with('category');
    if ($request->has('category_id')) $q->where('category_id', $request->category_id);
    if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
    return DishResource::collection($q->orderBy('name')->get());
}

public function show(Dish $dish) {
    $dish->load(['defaultIngredients', 'availableAdditions']);
    return new DishResource($dish);
}

public function store(StoreDishRequest $request) {
    $dish = Dish::create($request->safe()->except('ingredients'));

    if ($request->has('ingredients')) {
        $sync = collect($request->ingredients)->mapWithKeys(fn($i) => [
            $i['ingredient_id'] => ['is_default' => $i['is_default'] ?? true]
        ]);
        $dish->ingredients()->sync($sync);
    }

    return new DishResource($dish->load(['defaultIngredients', 'availableAdditions']));
}

public function update(UpdateDishRequest $request, Dish $dish) {
    $dish->update($request->safe()->except('ingredients'));

    if ($request->has('ingredients')) {
        $sync = collect($request->ingredients)->mapWithKeys(fn($i) => [
            $i['ingredient_id'] => ['is_default' => $i['is_default'] ?? true]
        ]);
        $dish->ingredients()->sync($sync);
    }

    return new DishResource($dish->fresh(['defaultIngredients', 'availableAdditions']));
}

public function toggle(Dish $dish) {
    $dish->update(['is_active' => !$dish->is_active]);
    $this->logActivity('DISH_TOGGLED', "Piatto '{$dish->name}' " . ($dish->is_active ? 'attivato' : 'disattivato'), $dish);
    return new DishResource($dish);
}
```

### DishResource

```php
public function toArray($request): array {
    return [
        'id'                  => $this->id,
        'name'                => $this->name,
        'description'         => $this->description,
        'price'               => $this->price,
        'category_id'         => $this->category_id,
        'category'            => new CategoryResource($this->whenLoaded('category')),
        'is_active'           => $this->is_active,
        'default_ingredients' => IngredientResource::collection($this->whenLoaded('defaultIngredients')),
        'available_additions' => IngredientResource::collection($this->whenLoaded('availableAdditions')),
    ];
}
```

---

## PizzaController

```php
public function show(Pizza $pizza) {
    $pizza->load(['defaultIngredients']);
    // Aggiunte disponibili = tutti gli ingredienti attivi NON già di default
    $defaultIds = $pizza->defaultIngredients->pluck('id');
    $availableAdditions = PizzaIngredient::where('is_active', true)
        ->whereNotIn('id', $defaultIds)->get();
    $variants = PizzaVariant::where('is_active', true)->get();

    return response()->json([
        'id'                   => $pizza->id,
        'name'                 => $pizza->name,
        'description'          => $pizza->description,
        'base_price'           => $pizza->base_price,
        'is_active'            => $pizza->is_active,
        'default_ingredients'  => $pizza->defaultIngredients,
        'available_additions'  => $availableAdditions,
        'variants'             => $variants,
    ]);
}
```

---

## Form Requests

### StoreDishRequest
```php
public function rules(): array {
    return [
        'name'                      => 'required|string|max:150',
        'description'               => 'nullable|string',
        'price'                     => 'required|numeric|min:0',
        'category_id'               => 'required|exists:categories,id',
        'is_active'                 => 'boolean',
        'ingredients'               => 'nullable|array',
        'ingredients.*.ingredient_id' => 'required|exists:ingredients,id',
        'ingredients.*.is_default'  => 'boolean',
    ];
}
```

### StorePizzaRequest
```php
public function rules(): array {
    return [
        'name'                           => 'required|string|max:150',
        'description'                    => 'nullable|string',
        'base_price'                     => 'required|numeric|min:0',
        'is_active'                      => 'boolean',
        'default_ingredients'            => 'nullable|array',
        'default_ingredients.*'          => 'exists:pizza_ingredients,id',
    ];
}
```

### StoreIngredientRequest / StorePizzaIngredientRequest
```php
public function rules(): array {
    return [
        'name'         => 'required|string|max:100',
        'price_add'    => 'required|numeric|min:0',
        'price_remove' => 'required|numeric|min:0',
        'is_active'    => 'boolean',
    ];
}
```

---

## Logiche importanti

### Disattivazione piatto
Quando `is_active = false`:
- Il piatto non compare nel menu tablet
- Gli ordini in corso con quel piatto NON vengono impattati (snapshot)
- Se un ingrediente di default viene disattivato mentre è in una pizza:
  - La pizza rimane ordinabile senza quell'ingrediente
  - Il prezzo finale decrementato di `price_remove`

### Filtro service_schedule sul tablet
Il cameriere chiama `GET /service-schedule/today` al boot.
Se `pizzeria = false` → le categorie con `department = pizzeria` vengono nascoste.
Se `cucina = false` → le categorie con `department IN [cucina]` vengono nascoste.
Questo filtering avviene **sul frontend**, non sulla query.

---

## Criteri di completamento

- [ ] `GET /api/v1/categories` restituisce 8 categorie dopo il seeder
- [ ] `GET /api/v1/dishes/{id}` include `default_ingredients` e `available_additions` separati
- [ ] `GET /api/v1/pizzas/{id}` include ingredienti default, aggiunte disponibili e varianti attive
- [ ] `PATCH /dishes/{id}/toggle` cambia `is_active` e logga l'azione
- [ ] `DELETE /categories/{id}` restituisce 422 se la categoria ha piatti
- [ ] Middleware `role:admin` blocca i POST/PUT/DELETE per i camerieri (403)
- [ ] Form Requests restituiscono 422 con messaggi di validazione
