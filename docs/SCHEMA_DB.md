# Schema Database — Sistema Gestione Comande

**Database:** MariaDB 11.4+ | **Tabelle:** 21 | **Versione:** 1.0

> Legenda: `PK` = Primary Key | `FK` = Foreign Key | `UK` = Unique Key

---

## Dominio: Sala & Utenti

### `users`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | |
| surname | VARCHAR(100) | NOT NULL | |
| username | VARCHAR(50) | NOT NULL, UK | |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt |
| role | ENUM('admin','waiter') | NOT NULL | |
| pin | VARCHAR(10) | NOT NULL | PIN tablet numerico |
| status | ENUM('active','inactive') | NOT NULL, DEFAULT 'active' | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

### `zones`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | es. Sotto, Fuori |
| is_outdoor | TINYINT(1) | NOT NULL, DEFAULT 0 | flag zona esterna |
| is_enabled | BOOLEAN | NOT NULL, DEFAULT 1 | abilitata da admin |
| sort_order | INT UNSIGNED | NOT NULL, DEFAULT 0 | |
| created_at | TIMESTAMP | NOT NULL | |

### `tables`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| zone_id | INT UNSIGNED | NOT NULL, FK → zones.id | |
| parent_table_id | INT UNSIGNED | NULLABLE, FK → tables.id | solo per Bis/Tris |
| number | INT UNSIGNED | NOT NULL | numero nella zona |
| suffix | ENUM('bis','tris') | NULLABLE | NULL = tavolo principale |
| status | ENUM('libero','occupato','in_corso') | NOT NULL, DEFAULT 'libero' | |
| created_at | TIMESTAMP | NOT NULL | |

**Index:** `UNIQUE(zone_id, number, suffix)` — attenzione a NULL per suffix.

---

## Dominio: Menu — Cucina

### `categories`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | |
| department | ENUM('cucina','pizzeria','bevande','dessert','amari') | NOT NULL | |
| sort_order | INT UNSIGNED | NOT NULL, DEFAULT 0 | |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |

### `dishes`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| category_id | INT UNSIGNED | NOT NULL, FK → categories.id | |
| name | VARCHAR(150) | NOT NULL | |
| description | TEXT | NULLABLE | |
| price | DECIMAL(8,2) | NOT NULL | |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

### `ingredient_categories`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | |
| department | ENUM('cucina','bar','pizzeria','vini') | NOT NULL, DEFAULT 'cucina' | reparto proprietario, separa le categorie ingredienti tra reparti |
| sort_order | INT UNSIGNED | NOT NULL, DEFAULT 0 | |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |

### `ingredients`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | |
| department | ENUM('cucina','bar','pizzeria','vini') | NOT NULL, DEFAULT 'cucina' | reparto proprietario, separa gli ingredienti tra reparti |
| ingredient_category_id | INT UNSIGNED | NULLABLE, FK → ingredient_categories.id | |
| price_add | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | prezzo aggiunta |
| price_remove | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | sconto rimozione |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |

### `dish_ingredients` *(pivot)*
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| dish_id | INT UNSIGNED | NOT NULL, FK → dishes.id | |
| ingredient_id | INT UNSIGNED | NOT NULL, FK → ingredients.id | |
| is_default | BOOLEAN | NOT NULL, DEFAULT 1 | 0 = solo aggiunta disponibile |

**Index:** `UNIQUE(dish_id, ingredient_id)`

### `dish_variant_groups`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | es. Porzione |
| department | ENUM('cucina','bar','pizzeria','vini') | NOT NULL, DEFAULT 'cucina' | reparto proprietario, separa i gruppi varianti tra reparti |
| is_required | BOOLEAN | NOT NULL, DEFAULT 0 | 1 = il cameriere deve scegliere un'opzione |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |
| sort_order | INT | NOT NULL, DEFAULT 0 | |

### `dish_variant_options`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| dish_variant_group_id | INT UNSIGNED | NOT NULL, FK → dish_variant_groups.id, CASCADE | |
| name | VARCHAR(100) | NOT NULL | es. Abbondante |
| price_add | DECIMAL(8,2) | NOT NULL, DEFAULT 0.00 | sovrapprezzo opzione |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |
| sort_order | INT | NOT NULL, DEFAULT 0 | |

### `dish_variant_group_dish` *(pivot)*
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| dish_id | INT UNSIGNED | NOT NULL, FK → dishes.id, CASCADE | |
| dish_variant_group_id | INT UNSIGNED | NOT NULL, FK → dish_variant_groups.id, CASCADE | |

**Index:** `UNIQUE(dish_id, dish_variant_group_id)`

---

## Dominio: Menu — Pizzeria

### `pizzas`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(150) | NOT NULL | |
| description | TEXT | NULLABLE | |
| base_price | DECIMAL(8,2) | NOT NULL | senza varianti/aggiunte |
| default_base | VARCHAR(10) | NULLABLE | base preselezionata nel configuratore: M, Rose', R, B, S |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

### `pizza_ingredients` *(archivio separato da cucina)*
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | |
| price_add | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | |
| price_remove | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |

### `pizza_default_ingredients` *(pivot)*
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| pizza_id | INT UNSIGNED | NOT NULL, FK → pizzas.id | |
| pizza_ingredient_id | INT UNSIGNED | NOT NULL, FK → pizza_ingredients.id | |

**Index:** `UNIQUE(pizza_id, pizza_ingredient_id)`

### `pizza_variants`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | es. Impasto ai Cereali |
| code | VARCHAR(20) | NOT NULL, UK | es. CERE, DOPP, NO LATT. |
| price_add | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | fisso per tutte le pizze |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |

**Seed obbligatorio:** CERE (€1.50), DOPP (€1.00), NO LATT. (€1.00)

---

## Dominio: Ordini & Stampa

### `orders`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| table_id | INT UNSIGNED | NOT NULL, FK → tables.id | |
| user_id | INT UNSIGNED | NOT NULL, FK → users.id | cameriere |
| covers | INT UNSIGNED | NOT NULL, DEFAULT 0 | 0 = non ancora inserito |
| order_number | INT UNSIGNED | NOT NULL, UK | progressivo globale #0042 |
| status | ENUM('open','closed','locked') | NOT NULL, DEFAULT 'open' | |
| total | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | aggiornato in tempo reale |
| opened_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| first_sent_at | TIMESTAMP | NULLABLE | primo invio |
| closed_at | TIMESTAMP | NULLABLE | |

**Index:** `UNIQUE(order_number)`, `INDEX(table_id, status)`

### `order_sends`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| order_id | INT UNSIGNED | NOT NULL, FK → orders.id | |
| send_number | INT UNSIGNED | NOT NULL | progressivo per ordine |
| sent_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Index:** `UNIQUE(order_id, send_number)`

### `order_items`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| order_id | INT UNSIGNED | NOT NULL, FK → orders.id | |
| order_send_id | INT UNSIGNED | NOT NULL, FK → order_sends.id | |
| item_type | ENUM('dish','pizza') | NOT NULL | |
| dish_id | INT UNSIGNED | NULLABLE, FK → dishes.id | se dish |
| pizza_id | INT UNSIGNED | NULLABLE, FK → pizzas.id | se pizza |
| quantity | INT UNSIGNED | NOT NULL, DEFAULT 1 | 1 se con varianti |
| unit_price | DECIMAL(8,2) | NOT NULL | snapshot al momento ordine |
| total_price | DECIMAL(10,2) | NOT NULL | unit_price × qty + mods |
| status | ENUM('pending','sent','cancelled') | NOT NULL, DEFAULT 'pending' | |
| notes | TEXT | NULLABLE | note libere |
| sort_order | INT UNSIGNED | NOT NULL, DEFAULT 0 | ordine portate |
| created_at | TIMESTAMP | NOT NULL | |

**Constraint:** `CHECK (item_type='dish' AND dish_id IS NOT NULL) OR (item_type='pizza' AND pizza_id IS NOT NULL)`

### `order_item_mods`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| order_item_id | INT UNSIGNED | NOT NULL, FK → order_items.id | |
| mod_type | VARCHAR(50) | NOT NULL | vedi valori sotto |
| mod_value | VARCHAR(200) | NOT NULL | |
| price_change | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | positivo o negativo |

**Valori mod_type:** `portion` · `cooking` · `ingredient_add` · `ingredient_remove` · `ingredient_portion` · `pizza_base` · `pizza_dough` · `pizza_mozzarella` · `pizza_variant` · `pizza_cut`

### `printers`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | NOT NULL | es. Stampante Cucina |
| department | ENUM('cassiere','cucina','pizzeria') | NOT NULL | |
| ip_address | VARCHAR(45) | NOT NULL | |
| port | INT UNSIGNED | NOT NULL, DEFAULT 9100 | |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

### `print_jobs`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| order_id | INT UNSIGNED | NOT NULL, FK → orders.id | |
| order_send_id | INT UNSIGNED | NOT NULL, FK → order_sends.id | |
| printer_id | INT UNSIGNED | NULLABLE, FK → printers.id | |
| print_type | ENUM('cassiere','cucina','pizzeria') | NOT NULL | |
| status | ENUM('pending','printing','done','failed') | NOT NULL, DEFAULT 'pending' | |
| attempts | INT UNSIGNED | NOT NULL, DEFAULT 0 | |
| pdf_backup_path | VARCHAR(500) | NULLABLE | eliminato a chiusura tavolo |
| created_at | TIMESTAMP | NOT NULL | |
| printed_at | TIMESTAMP | NULLABLE | |

**Index:** `INDEX(status, created_at)`

---

## Dominio: Supporto & Configurazione

### `service_schedule`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| department | ENUM('cucina','pizzeria') | NOT NULL | |
| day_of_week | TINYINT UNSIGNED | NOT NULL | 0=Lun, 6=Dom |
| is_active | BOOLEAN | NOT NULL, DEFAULT 1 | |

**Index:** `UNIQUE(department, day_of_week)`

### `daily_closures`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| closed_by | INT UNSIGNED | NOT NULL, FK → users.id | |
| closed_at | TIMESTAMP | NOT NULL | |
| report_pdf_path | VARCHAR(500) | NULLABLE | |
| is_locked | BOOLEAN | NOT NULL, DEFAULT 1 | |
| notes | TEXT | NULLABLE | |

### `system_settings`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | INT UNSIGNED | PK, AUTO_INCREMENT | |
| key | VARCHAR(100) | NOT NULL, UK | |
| value | TEXT | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Seed obbligatorio:**
```
tablet_pin = 1234
inactivity_timeout = 300
close_table_message = Confermi la chiusura del tavolo? I dati andranno persi.
```

### `activity_logs`
| Campo | Tipo | Vincoli | Note |
|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| user_id | INT UNSIGNED | NULLABLE, FK → users.id | NULL = azione di sistema |
| action | VARCHAR(100) | NOT NULL | es. TABLE_CLOSED, ORDER_SENT |
| description | TEXT | NOT NULL | testo leggibile |
| entity_type | VARCHAR(50) | NULLABLE | es. orders, tables |
| entity_id | INT UNSIGNED | NULLABLE | ID record coinvolto |
| ip_address | VARCHAR(45) | NULLABLE | |
| created_at | TIMESTAMP | NOT NULL | |

**Index:** `INDEX(user_id, created_at)`, `INDEX(entity_type, entity_id)`
**Retention:** 6 mesi — job pulizia automatica mensile

---

## Indici globali raccomandati

```sql
CREATE INDEX idx_orders_table_status ON orders(table_id, status);
CREATE INDEX idx_order_items_order ON order_items(order_id, status);
CREATE INDEX idx_print_jobs_status ON print_jobs(status, created_at);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at);
CREATE INDEX idx_tables_zone_status ON tables(zone_id, status);
```

## Cascade delete

| Relazione | ON DELETE |
|---|---|
| orders → tables | RESTRICT |
| order_items → orders | CASCADE |
| order_item_mods → order_items | CASCADE |
| print_jobs → orders | CASCADE |
| dish_ingredients → dishes | CASCADE |
| pizza_default_ingredients → pizzas | CASCADE |
| activity_logs → users | SET NULL |
| ingredients → ingredient_categories | SET NULL |
