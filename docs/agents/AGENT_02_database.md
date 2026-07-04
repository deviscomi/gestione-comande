# AGENT 02 — Database: Migrazioni, Modelli & Seeders

**Dipendenze:** AGENT_01 completato. Connessione DB attiva.
**Output atteso:** 21 migrazioni, tutti i modelli Eloquent con relazioni, seeders e factories.

---

## Obiettivo

Creare l'intera struttura dati del sistema:
- 21 migrazioni MariaDB nell'ordine corretto
- Eloquent Models con relazioni, scopes e accessor
- Seeders per dati iniziali obbligatori
- Factories per testing

---

## Ordine migrazioni (rispettare la sequenza per le FK)

```
1.  create_users_table
2.  create_zones_table
3.  create_tables_table
4.  create_categories_table
5.  create_ingredients_table
6.  create_dishes_table
7.  create_dish_ingredients_table
8.  create_pizza_ingredients_table
9.  create_pizza_variants_table
10. create_pizzas_table
11. create_pizza_default_ingredients_table
12. create_orders_table
13. create_order_sends_table
14. create_order_items_table
15. create_order_item_mods_table
16. create_printers_table
17. create_print_jobs_table
18. create_service_schedule_table
19. create_daily_closures_table
20. create_system_settings_table
21. create_activity_logs_table
```

---

## Migrazioni dettagliate

### 1. users
```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name', 100);
    $table->string('surname', 100);
    $table->string('username', 50)->unique();
    $table->string('password_hash', 255);
    $table->enum('role', ['admin', 'waiter']);
    $table->string('pin', 10);
    $table->enum('status', ['active', 'inactive'])->default('active');
    $table->timestamps();
});
```

### 2. zones
```php
Schema::create('zones', function (Blueprint $table) {
    $table->id();
    $table->string('name', 100);
    $table->boolean('is_outdoor')->default(false);
    $table->boolean('is_enabled')->default(true);
    $table->unsignedInteger('sort_order')->default(0);
    $table->timestamp('created_at')->useCurrent();
});
```

### 3. tables
```php
Schema::create('tables', function (Blueprint $table) {
    $table->id();
    $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
    $table->foreignId('parent_table_id')->nullable()->constrained('tables')->nullOnDelete();
    $table->unsignedInteger('number');
    $table->enum('suffix', ['bis', 'tris'])->nullable();
    $table->enum('status', ['libero', 'occupato', 'in_corso'])->default('libero');
    $table->timestamp('created_at')->useCurrent();
    $table->unique(['zone_id', 'number', 'suffix']);
    $table->index(['zone_id', 'status']);
});
```

### 4. categories
```php
Schema::create('categories', function (Blueprint $table) {
    $table->id();
    $table->string('name', 100);
    $table->enum('department', ['cucina', 'pizzeria', 'bevande', 'dessert', 'amari']);
    $table->unsignedInteger('sort_order')->default(0);
    $table->boolean('is_active')->default(true);
});
```

### 5. ingredients (cucina)
```php
Schema::create('ingredients', function (Blueprint $table) {
    $table->id();
    $table->string('name', 100);
    $table->decimal('price_add', 6, 2)->default(0.00);
    $table->decimal('price_remove', 6, 2)->default(0.00);
    $table->boolean('is_active')->default(true);
});
```

### 6. dishes
```php
Schema::create('dishes', function (Blueprint $table) {
    $table->id();
    $table->foreignId('category_id')->constrained()->restrictOnDelete();
    $table->string('name', 150);
    $table->text('description')->nullable();
    $table->decimal('price', 8, 2);
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

### 7. dish_ingredients
```php
Schema::create('dish_ingredients', function (Blueprint $table) {
    $table->id();
    $table->foreignId('dish_id')->constrained()->cascadeOnDelete();
    $table->foreignId('ingredient_id')->constrained()->restrictOnDelete();
    $table->boolean('is_default')->default(true);
    $table->unique(['dish_id', 'ingredient_id']);
});
```

### 8. pizza_ingredients
```php
Schema::create('pizza_ingredients', function (Blueprint $table) {
    $table->id();
    $table->string('name', 100);
    $table->decimal('price_add', 6, 2)->default(0.00);
    $table->decimal('price_remove', 6, 2)->default(0.00);
    $table->boolean('is_active')->default(true);
});
```

### 9. pizza_variants
```php
Schema::create('pizza_variants', function (Blueprint $table) {
    $table->id();
    $table->string('name', 100);
    $table->string('code', 20)->unique();
    $table->decimal('price_add', 6, 2)->default(0.00);
    $table->boolean('is_active')->default(true);
});
```

### 10. pizzas
```php
Schema::create('pizzas', function (Blueprint $table) {
    $table->id();
    $table->string('name', 150);
    $table->text('description')->nullable();
    $table->decimal('base_price', 8, 2);
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

### 11. pizza_default_ingredients
```php
Schema::create('pizza_default_ingredients', function (Blueprint $table) {
    $table->id();
    $table->foreignId('pizza_id')->constrained()->cascadeOnDelete();
    $table->foreignId('pizza_ingredient_id')
          ->constrained('pizza_ingredients')->restrictOnDelete();
    $table->unique(['pizza_id', 'pizza_ingredient_id']);
});
```

### 12. orders
```php
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('table_id')->constrained('tables')->restrictOnDelete();
    $table->foreignId('user_id')->constrained()->restrictOnDelete();
    $table->unsignedInteger('covers')->default(0);
    $table->unsignedInteger('order_number')->unique();
    $table->enum('status', ['open', 'closed', 'locked'])->default('open');
    $table->decimal('total', 10, 2)->default(0.00);
    $table->timestamp('opened_at')->useCurrent();
    $table->timestamp('first_sent_at')->nullable();
    $table->timestamp('closed_at')->nullable();
    $table->index(['table_id', 'status']);
});
```

### 13. order_sends
```php
Schema::create('order_sends', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->cascadeOnDelete();
    $table->unsignedInteger('send_number');
    $table->timestamp('sent_at')->useCurrent();
    $table->unique(['order_id', 'send_number']);
});
```

### 14. order_items
```php
Schema::create('order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->cascadeOnDelete();
    $table->foreignId('order_send_id')->constrained()->cascadeOnDelete();
    $table->enum('item_type', ['dish', 'pizza']);
    $table->foreignId('dish_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('pizza_id')->nullable()->constrained()->nullOnDelete();
    $table->unsignedInteger('quantity')->default(1);
    $table->decimal('unit_price', 8, 2);
    $table->decimal('total_price', 10, 2);
    $table->enum('status', ['pending', 'sent', 'cancelled'])->default('pending');
    $table->text('notes')->nullable();
    $table->unsignedInteger('sort_order')->default(0);
    $table->timestamp('created_at')->useCurrent();
    $table->index(['order_id', 'status']);
});
```

### 15. order_item_mods
```php
Schema::create('order_item_mods', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
    $table->string('mod_type', 50);
    $table->string('mod_value', 200);
    $table->decimal('price_change', 6, 2)->default(0.00);
});
```

### 16. printers
```php
Schema::create('printers', function (Blueprint $table) {
    $table->id();
    $table->string('name', 100);
    $table->enum('department', ['cassiere', 'cucina', 'pizzeria']);
    $table->string('ip_address', 45);
    $table->unsignedInteger('port')->default(9100);
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

### 17. print_jobs
```php
Schema::create('print_jobs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->cascadeOnDelete();
    $table->foreignId('order_send_id')->constrained()->cascadeOnDelete();
    $table->foreignId('printer_id')->nullable()->constrained()->nullOnDelete();
    $table->enum('print_type', ['cassiere', 'cucina', 'pizzeria']);
    $table->enum('status', ['pending', 'printing', 'done', 'failed'])->default('pending');
    $table->unsignedInteger('attempts')->default(0);
    $table->string('pdf_backup_path', 500)->nullable();
    $table->timestamp('created_at')->useCurrent();
    $table->timestamp('printed_at')->nullable();
    $table->index(['status', 'created_at']);
});
```

### 18. service_schedule
```php
Schema::create('service_schedule', function (Blueprint $table) {
    $table->id();
    $table->enum('department', ['cucina', 'pizzeria']);
    $table->unsignedTinyInteger('day_of_week'); // 0=Lun, 6=Dom
    $table->boolean('is_active')->default(true);
    $table->unique(['department', 'day_of_week']);
});
```

### 19. daily_closures
```php
Schema::create('daily_closures', function (Blueprint $table) {
    $table->id();
    $table->foreignId('closed_by')->constrained('users')->restrictOnDelete();
    $table->timestamp('closed_at')->useCurrent();
    $table->string('report_pdf_path', 500)->nullable();
    $table->boolean('is_locked')->default(true);
    $table->text('notes')->nullable();
});
```

### 20. system_settings
```php
Schema::create('system_settings', function (Blueprint $table) {
    $table->id();
    $table->string('key', 100)->unique();
    $table->text('value');
    $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
});
```

### 21. activity_logs
```php
Schema::create('activity_logs', function (Blueprint $table) {
    $table->unsignedBigInteger('id')->autoIncrement()->primary();
    $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
    $table->string('action', 100);
    $table->text('description');
    $table->string('entity_type', 50)->nullable();
    $table->unsignedInteger('entity_id')->nullable();
    $table->string('ip_address', 45)->nullable();
    $table->timestamp('created_at')->useCurrent();
    $table->index(['user_id', 'created_at']);
    $table->index(['entity_type', 'entity_id']);
    $table->index('created_at');
});
```

---

## Modelli Eloquent — relazioni chiave

### User
```php
protected $fillable = ['name','surname','username','password_hash','role','pin','status'];
protected $hidden = ['password_hash'];

public function orders(): HasMany { return $this->hasMany(Order::class); }
public function activityLogs(): HasMany { return $this->hasMany(ActivityLog::class); }
public function scopeActive($q) { return $q->where('status', 'active'); }
```

### Zone
```php
public function tables(): HasMany { return $this->hasMany(Table::class); }
public function scopeEnabled($q) { return $q->where('is_enabled', true); }
```

### Table (usa alias per evitare conflitti con parola riservata)
```php
protected $table = 'tables';

public function zone(): BelongsTo { return $this->belongsTo(Zone::class); }
public function parent(): BelongsTo { return $this->belongsTo(Table::class, 'parent_table_id'); }
public function children(): HasMany { return $this->hasMany(Table::class, 'parent_table_id'); }
public function activeOrder(): HasOne {
    return $this->hasOne(Order::class)->whereIn('status', ['open']);
}
```

### Dish
```php
public function category(): BelongsTo { return $this->belongsTo(Category::class); }
public function ingredients(): BelongsToMany {
    return $this->belongsToMany(Ingredient::class, 'dish_ingredients')
                ->withPivot('is_default');
}
public function defaultIngredients() { return $this->ingredients()->wherePivot('is_default', true); }
public function availableAdditions() { return $this->ingredients()->wherePivot('is_default', false); }
```

### Pizza
```php
public function defaultIngredients(): BelongsToMany {
    return $this->belongsToMany(PizzaIngredient::class, 'pizza_default_ingredients');
}
```

### Order
```php
public function table(): BelongsTo { return $this->belongsTo(Table::class); }
public function user(): BelongsTo { return $this->belongsTo(User::class); }
public function sends(): HasMany { return $this->hasMany(OrderSend::class); }
public function items(): HasMany { return $this->hasMany(OrderItem::class); }
public function printJobs(): HasMany { return $this->hasMany(PrintJob::class); }

public function recalculateTotal(): void {
    $this->total = $this->items()
        ->where('status', '!=', 'cancelled')
        ->sum('total_price');
    $this->save();
}
```

### OrderItem
```php
public function order(): BelongsTo { return $this->belongsTo(Order::class); }
public function send(): BelongsTo { return $this->belongsTo(OrderSend::class, 'order_send_id'); }
public function modifications(): HasMany { return $this->hasMany(OrderItemMod::class); }
public function dish(): BelongsTo { return $this->belongsTo(Dish::class); }
public function pizza(): BelongsTo { return $this->belongsTo(Pizza::class); }
```

### PrintJob
```php
public function order(): BelongsTo { return $this->belongsTo(Order::class); }
public function printer(): BelongsTo { return $this->belongsTo(Printer::class); }
public function scopePending($q) { return $q->where('status', 'pending'); }
public function scopeFailed($q) { return $q->where('status', 'failed'); }
```

---

## Seeders

### DatabaseSeeder.php
```php
public function run(): void {
    $this->call([
        UserSeeder::class,
        ZoneSeeder::class,
        TableSeeder::class,
        CategorySeeder::class,
        PizzaVariantSeeder::class,
        ServiceScheduleSeeder::class,
        SystemSettingsSeeder::class,
    ]);
}
```

### ZoneSeeder
Crea 4 zone: Sotto (sort=1), Sopra (sort=2), Saletta Sopra (sort=3), Fuori (sort=4, is_outdoor=true).

### TableSeeder
- 10 tavoli in Sotto (numeri 1-10)
- 10 tavoli in Sopra (numeri 1-10)
- 3 tavoli in Saletta Sopra (numeri 1-3)
- 10 tavoli in Fuori (numeri 1-10)

### CategorySeeder
8 categorie con sort_order: Antipasti (cucina,1), Primi (cucina,2), Secondi (cucina,3),
Contorni (cucina,4), Pizze (pizzeria,5), Bevande (bevande,6), Dessert (dessert,7), Amari (amari,8).

### PizzaVariantSeeder
```php
PizzaVariant::insert([
    ['name' => 'Impasto ai Cereali', 'code' => 'CERE', 'price_add' => 1.50, 'is_active' => true],
    ['name' => 'Doppio Impasto',     'code' => 'DOPP', 'price_add' => 1.00, 'is_active' => true],
    ['name' => 'No Lattosio',        'code' => 'NO LATT.', 'price_add' => 1.00, 'is_active' => true],
]);
```

### ServiceScheduleSeeder
Crea 7 righe per cucina (lun-dom, tutte attive) + 7 righe per pizzeria (lun-dom, tutte attive).

### SystemSettingsSeeder
```php
SystemSetting::insert([
    ['key' => 'tablet_pin', 'value' => '1234'],
    ['key' => 'inactivity_timeout', 'value' => '300'],
    ['key' => 'close_table_message', 'value' => 'Confermi la chiusura del tavolo? I dati andranno persi.'],
]);
```

### UserSeeder
```php
User::create([
    'name' => 'Admin', 'surname' => 'Sistema', 'username' => 'admin',
    'password_hash' => Hash::make('admin123'), 'role' => 'admin', 'pin' => '0000',
]);
User::create([
    'name' => 'Mario', 'surname' => 'Rossi', 'username' => 'mario',
    'password_hash' => Hash::make('mario123'), 'role' => 'waiter', 'pin' => '1234',
]);
```

---

## Criteri di completamento

- [ ] `php artisan migrate --seed` esegue senza errori
- [ ] 21 tabelle create nel DB con tutti i campi e indici
- [ ] `Zone::count() === 4` (tinker)
- [ ] `Table::count() === 33` (tinker)
- [ ] `Category::count() === 8` (tinker)
- [ ] `PizzaVariant::count() === 3` (tinker)
- [ ] `User::where('role','admin')->count() === 1` (tinker)
- [ ] Relazioni: `Zone::first()->tables` restituisce collection
- [ ] `Order::first()?->recalculateTotal()` non genera errori
