# Mappa API REST — Sistema Gestione Comande

**Base URL:** `/api/v1` | **Auth:** Bearer Token (Sanctum) | **Formato:** JSON
**WebSocket:** Laravel Reverb | **Totale:** 57 endpoint REST + 5 canali WS

> Ruoli: `admin` = solo admin | `waiter` = solo cameriere | `both` = entrambi | `public` = no auth

---

## 1. Autenticazione

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| POST | `/auth/login` | public | Login — restituisce Bearer token Sanctum |
| POST | `/auth/logout` | both | Logout — invalida token corrente |
| GET | `/auth/me` | both | Profilo utente autenticato |
| POST | `/auth/refresh` | both | Rinnova token di sessione |
| POST | `/auth/force-logout/{userId}` | admin | Forza logout remoto cameriere via WebSocket |

**Login request:** `{ "username": "mario", "password": "secret" }`
**Login response:** `{ "token": "1|abc...", "user": { "id": 1, "name": "Mario", "role": "waiter" } }`

---

## 2. Zone

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/zones` | both | Lista zone con stato abilitazione |
| POST | `/zones` | admin | Crea nuova zona |
| PUT | `/zones/{id}` | admin | Modifica nome/impostazioni zona |
| DELETE | `/zones/{id}` | admin | Elimina zona (solo se tutti i tavoli liberi) |
| PATCH | `/zones/{id}/toggle` | both | Abilita/disabilita zona (cameriere solo su `is_outdoor=1`) |

---

## 3. Tavoli

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/tables` | both | Lista tavoli (filtri: `?zone_id=&status=`) |
| POST | `/tables` | admin | Crea tavolo da backoffice |
| GET | `/tables/{id}` | both | Dettaglio con ordine attivo se presente |
| PUT | `/tables/{id}` | admin | Modifica numero/zona |
| DELETE | `/tables/{id}` | admin | Elimina (solo se status=libero) |
| PATCH | `/tables/{id}/status` | both | Cambia status: `libero` o `occupato` |
| PATCH | `/tables/{id}/covers` | waiter | Aggiorna coperti: `{ "covers": 4 }` |
| POST | `/tables/{id}/duplicate` | waiter | Crea Bis/Tris: `{ "suffix": "bis" }` |
| DELETE | `/tables/{id}/duplicate` | waiter | Elimina Bis/Tris (solo se libero, con conferma) |
| PATCH | `/tables/{id}/move-order` | waiter | Sposta ordine: `{ "target_table_id": 15 }` |

---

## 4. Menu — Cucina

### Categorie
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/categories` | both | Lista (filtri: `?is_active=&department=`) |
| POST | `/categories` | admin | Crea categoria |
| PUT | `/categories/{id}` | admin | Modifica |
| DELETE | `/categories/{id}` | admin | Elimina (solo se senza piatti) |
| PATCH | `/categories/{id}/toggle` | admin | Attiva/disattiva |

### Piatti
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/dishes` | both | Lista (filtri: `?category_id=&is_active=`), include gruppi varianti |
| POST | `/dishes` | admin | Crea con ingredienti default e `variant_group_ids` |
| GET | `/dishes/{id}` | both | Dettaglio con ingredienti separati (default / aggiuntivi disponibili) e gruppi varianti con opzioni |
| PUT | `/dishes/{id}` | admin | Modifica (sync `variant_group_ids`) |
| DELETE | `/dishes/{id}` | admin | Soft delete |
| PATCH | `/dishes/{id}/toggle` | admin | Attiva/disattiva disponibilità |

### Ingredienti
Ingredienti separati per reparto (`department`: `cucina`, `bar`, `pizzeria`, `vini`). Ogni reparto vede e gestisce solo i propri.

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/ingredients` | both | Lista (filtri: `?is_active=&ingredient_category_id=&department=`) |
| POST | `/ingredients` | admin | Crea con price_add, price_remove e `department` (obbligatorio) |
| PUT | `/ingredients/{id}` | admin | Modifica |
| DELETE | `/ingredients/{id}` | admin | Elimina |
| PATCH | `/ingredients/{id}/toggle` | admin | Attiva/disattiva |

### Categorie ingredienti
Anch'esse separate per reparto tramite `department`.

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/ingredient-categories` | both | Lista (filtri: `?is_active=&department=`) |
| POST | `/ingredient-categories` | admin | Crea categoria con `department` (obbligatorio) |
| PUT | `/ingredient-categories/{id}` | admin | Modifica |
| DELETE | `/ingredient-categories/{id}` | admin | Elimina (solo se senza ingredienti associati) |
| PATCH | `/ingredient-categories/{id}/toggle` | admin | Attiva/disattiva |

### Varianti piatti
Gruppi varianti separati per reparto tramite `department`.

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/dish-variant-groups` | both | Lista gruppi con opzioni (filtri: `?is_active=&department=`) |
| POST | `/dish-variant-groups` | admin | Crea gruppo con `department` (obbligatorio) e `options: [{name, price_add}]` |
| GET | `/dish-variant-groups/{id}` | both | Dettaglio con opzioni |
| PUT | `/dish-variant-groups/{id}` | admin | Modifica, sync opzioni (`options: [{id?, name, price_add}]`) |
| DELETE | `/dish-variant-groups/{id}` | admin | Elimina (cascade su opzioni e associazioni piatto) |
| PATCH | `/dish-variant-groups/{id}/toggle` | admin | Attiva/disattiva |

---

## 5. Menu — Pizzeria

### Pizze
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/pizzas` | both | Lista con ingredienti default |
| POST | `/pizzas` | admin | Crea con ingredienti |
| GET | `/pizzas/{id}` | both | Dettaglio completo (ingredienti + varianti + prezzi) |
| PUT | `/pizzas/{id}` | admin | Modifica |
| DELETE | `/pizzas/{id}` | admin | Elimina |
| PATCH | `/pizzas/{id}/toggle` | admin | Attiva/disattiva |

**GET /pizzas/{id} response:**
```json
{
  "id": 3, "name": "Diavola", "base_price": "9.00",
  "default_base": "R",
  "default_ingredients": [
    { "id": 2, "name": "Salame piccante", "price_add": "0.50", "price_remove": "0.80" }
  ],
  "available_additions": [
    { "id": 8, "name": "Funghi", "price_add": "1.00" }
  ],
  "variants": [
    { "id": 1, "name": "Impasto ai cereali", "code": "CERE", "price_add": "1.50" }
  ]
}
```

### Ingredienti pizzeria
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/pizza-ingredients` | both | Lista |
| POST | `/pizza-ingredients` | admin | Crea |
| PUT | `/pizza-ingredients/{id}` | admin | Modifica |
| DELETE | `/pizza-ingredients/{id}` | admin | Elimina |
| PATCH | `/pizza-ingredients/{id}/toggle` | admin | Attiva/disattiva |

### Varianti pizza
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/pizza-variants` | both | Lista (CERE, DOPP, NO LATT.) |
| POST | `/pizza-variants` | admin | Crea variante con prezzo fisso |
| PUT | `/pizza-variants/{id}` | admin | Modifica |
| DELETE | `/pizza-variants/{id}` | admin | Elimina |
| PATCH | `/pizza-variants/{id}/toggle` | admin | Attiva/disattiva |

---

## 6. Ordini

### CRUD ordini
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/orders` | admin | Lista con filtri (`?from=&to=&table_id=&user_id=&status=`) |
| GET | `/orders/active` | waiter | Ordini aperti per il tablet |
| POST | `/orders` | waiter | Crea ordine: `{ "table_id": 5 }` → imposta tavolo su 'occupato' |
| GET | `/orders/{id}` | both | Dettaglio con tutti gli invii e articoli |
| PATCH | `/orders/{id}/close` | waiter | Chiude tavolo → `order.status=closed`, `table.status=libero`, elimina PDF backup |
| GET | `/orders/history` | admin | Storico ordini chiusi |

### Articoli ordine
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/orders/{id}/items` | both | Lista articoli raggruppati per invio |
| POST | `/orders/{id}/items` | waiter | Aggiunge articolo al carrello (status=pending) |
| PUT | `/orders/{id}/items/{itemId}` | waiter | Modifica articolo non ancora inviato |
| DELETE | `/orders/{id}/items/{itemId}` | both | Annulla articolo (no stampa, gestione a voce) |

**POST /orders/{id}/items — piatto:**
```json
{
  "item_type": "dish",
  "dish_id": 5,
  "quantity": 2,
  "notes": "senza aglio",
  "modifications": [
    { "mod_type": "portion", "mod_value": "abbondante", "price_change": 0 },
    { "mod_type": "cooking", "mod_value": "media", "price_change": 0 }
  ]
}
```

**POST /orders/{id}/items — pizza:**
```json
{
  "item_type": "pizza",
  "pizza_id": 3,
  "quantity": 1,
  "notes": "",
  "modifications": [
    { "mod_type": "pizza_base",       "mod_value": "R",         "price_change": 0 },
    { "mod_type": "pizza_dough",      "mod_value": "CERE",      "price_change": 1.50 },
    { "mod_type": "pizza_mozzarella", "mod_value": "NO LATT.",  "price_change": 1.00 },
    { "mod_type": "ingredient_add",   "mod_value": "8",         "price_change": 0.50 },
    { "mod_type": "ingredient_remove","mod_value": "2",         "price_change": -0.80 },
    { "mod_type": "pizza_cut",        "mod_value": "spicchi",   "price_change": 0 }
  ]
}
```

### Invio comanda — endpoint principale
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| **POST** | **`/orders/{id}/send`** | waiter | **Invia comanda — attiva PrintDispatcher** |
| GET | `/orders/{id}/sends` | both | Lista invii effettuati |
| GET | `/orders/{id}/sends/{sendId}` | both | Dettaglio singolo invio |

**POST /orders/{id}/send — response:**
```json
{
  "send_id": 12,
  "send_number": 2,
  "print_jobs": [
    { "id": 34, "print_type": "cassiere", "status": "pending" },
    { "id": 35, "print_type": "cucina",   "status": "pending" }
  ],
  "table_status": "in_corso"
}
```

**Flusso interno POST /send:**
1. Verifica `covers > 0` — 422 se 0
2. Recupera `order_items` con `status=pending`
3. Se nessun pending — 422
4. Crea `order_sends` con `send_number` incrementale
5. Aggiorna items: `status=sent`, `order_send_id=nuovo`
6. Se primo invio: `orders.first_sent_at=now()`, `table.status=in_corso`
7. Chiama `PrintDispatcher::dispatch(order, orderSend)`
8. Ricalcola `orders.total`
9. Broadcast `OrderSent` su `orders.{orderId}`

---

## 7. Stampa

### Stampanti
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/printers` | admin | Lista stampanti configurate |
| POST | `/printers` | admin | Aggiunge: `{ "name", "department", "ip_address", "port": 9100 }` |
| PUT | `/printers/{id}` | admin | Modifica configurazione |
| DELETE | `/printers/{id}` | admin | Elimina |
| PATCH | `/printers/{id}/toggle` | admin | Abilita/disabilita |
| POST | `/printers/{id}/test` | admin | Stampa foglio di prova — 503 se non raggiungibile |

### Coda di stampa
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/print-jobs` | admin | Lista job (filtri: `?status=&from=&to=`) |
| GET | `/print-jobs/{id}` | both | Dettaglio job |
| POST | `/print-jobs/{id}/retry` | both | Retry manuale job fallito |
| POST | `/print-jobs/{id}/reprint` | both | Ristampa con flag `*** RISTAMPA ***` |
| GET | `/orders/{id}/print-jobs` | both | Tutti i job di un ordine |
| POST | `/orders/{id}/sends/{sendId}/reprint` | both | Ristampa singolo invio (1 copia) |

---

## 8. Backoffice Admin

### Camerieri
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/users` | admin | Lista camerieri |
| POST | `/users` | admin | Crea: `{ "name", "surname", "username", "password", "pin" }` |
| GET | `/users/{id}` | admin | Dettaglio |
| PUT | `/users/{id}` | admin | Modifica |
| DELETE | `/users/{id}` | admin | Elimina (soft delete se ha ordini) |
| PATCH | `/users/{id}/toggle` | admin | Attiva/disattiva |
| PATCH | `/users/{id}/pin` | admin | Modifica PIN: `{ "pin": "5678" }` |

### Service schedule
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/service-schedule` | both | Giorni attivi per cucina e pizzeria |
| PUT | `/service-schedule` | admin | Aggiorna: array `[{ "department", "day_of_week", "is_active" }]` |
| GET | `/service-schedule/today` | both | Reparti attivi oggi: `{ "cucina": true, "pizzeria": false }` |

### Dashboard
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/dashboard` | admin | Snapshot sala: tavoli, status, coperti, totali |
| GET | `/dashboard/summary` | admin | Riepilogo giornata corrente |

### Impostazioni
| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/settings` | admin | Lista impostazioni |
| PUT | `/settings` | admin | Aggiorna: `[{ "key", "value" }]` |
| GET | `/settings/{key}` | both | Valore singola impostazione |
| PUT | `/settings/pin` | admin | Aggiorna PIN tablet |

---

## 9. Report & Storico

| Metodo | Endpoint | Ruolo | Descrizione |
|---|---|---|---|
| GET | `/reports/daily` | admin | Fatturato giornaliero (`?date=2026-06-01`) |
| GET | `/reports/dishes` | admin | Piatti più ordinati (`?from=&to=&category_id=`) |
| GET | `/reports/covers` | admin | Coperti medi per tavolo/servizio |
| GET | `/reports/hourly` | admin | Fatturato per fascia oraria |
| GET | `/reports/pizza-toppings` | admin | Ingredienti pizza più richiesti |
| GET | `/reports/spend-per-cover` | admin | Spesa media per coperto |
| GET | `/reports/weekly` | admin | Confronto fatturato settimanale |
| GET | `/reports/monthly` | admin | Confronto mensile (`?year=2026`) |
| GET | `/reports/waiters` | admin | Performance camerieri |
| POST | `/reports/export` | admin | Export PDF: `{ "report_type", "params" }` |
| GET | `/orders/history` | admin | Storico ordini chiusi |
| GET | `/daily-closures/check` | admin | Verifica tavoli aperti pre-chiusura |
| POST | `/daily-closures` | admin | Avvia chiusura giornaliera |
| GET | `/activity-logs` | admin | Log attività (filtri: `?user_id=&action=&from=&to=`) |

---

## 10. Canali WebSocket (Laravel Reverb)

| Canale | Tipo | Accesso | Eventi |
|---|---|---|---|
| `orders.{orderId}` | private | both | `OrderUpdated`, `ItemAdded`, `ItemCancelled`, `PrintJobStatus` |
| `tables.{tableId}` | private | both | `TableStatusChanged`, `CoverUpdated`, `OrderMoved` |
| `print-jobs.{jobId}` | private | both | `PrintJobStatusChanged { status, attempts, pdf_path }` |
| `admin.dashboard` | private | admin | `DashboardUpdated` — snapshot completo sala |
| `user.{userId}` | private | both | `ForceLogout` — admin forza disconnect |

**PrintJobStatusChanged payload:**
```json
{
  "job_id": 34,
  "print_type": "cassiere",
  "status": "failed",
  "attempts": 3,
  "pdf_backup_path": "/storage/backups/order_42_send_2_cassiere.pdf"
}
```
