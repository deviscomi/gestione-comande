# AGENT 01 — Setup & Infrastruttura

**Dipendenze:** nessuna — questo è il primo agente da eseguire.
**Output atteso:** monorepo funzionante con backend Laravel + frontend React PWA pronti per lo sviluppo.

---

## Obiettivo

Configura l'intera infrastruttura del progetto Sistema di Gestione Comande:
- Monorepo con `backend/` (Laravel 11) e `frontend/` (React + Vite PWA)
- Docker Compose con tutti i servizi necessari
- Laravel Sanctum per auth, Reverb per WebSocket, Queue per stampa asincrona
- React configurato come PWA installabile su tablet Android

---

## Stack

| Layer | Tecnologia | Versione |
|---|---|---|
| Backend | Laravel | 11.x |
| Auth | Laravel Sanctum | 3.x |
| WebSocket | Laravel Reverb | 1.x |
| Queue | Laravel Queue (database driver) | — |
| Frontend | React + Vite | 18.x + 5.x |
| PWA | vite-plugin-pwa | latest |
| State | Zustand | 4.x |
| Data fetching | TanStack Query | 5.x |
| CSS | Tailwind CSS + @tailwindcss/forms | 3.x |
| WS Client | laravel-echo + pusher-js | latest |

---

## Struttura monorepo da creare

```
gestione-comande/
├── CLAUDE.md
├── docs/
├── backend/
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/V1/
│   │   │   ├── Requests/
│   │   │   ├── Resources/
│   │   │   └── Middleware/
│   │   ├── Services/
│   │   │   ├── PrintDispatcher.php
│   │   │   ├── PdfBackupGenerator.php
│   │   │   ├── ReportService.php
│   │   │   └── DailyClosureService.php
│   │   ├── Jobs/
│   │   │   └── ProcessPrintJob.php
│   │   ├── Events/
│   │   │   ├── OrderSent.php
│   │   │   ├── PrintJobStatusChanged.php
│   │   │   ├── TableStatusChanged.php
│   │   │   └── ForceLogout.php
│   │   └── Traits/
│   │       └── LogsActivity.php
│   └── routes/
│       ├── api.php
│       └── channels.php
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── axios.js
│       │   └── endpoints/
│       ├── components/
│       │   ├── tablet/
│       │   └── admin/
│       ├── pages/
│       │   ├── tablet/
│       │   └── admin/
│       ├── hooks/
│       ├── store/
│       │   ├── useAuthStore.js
│       │   ├── useTableStore.js
│       │   ├── useOrderStore.js
│       │   └── usePrintStore.js
│       └── utils/
└── docker-compose.yml
```

---

## Step 1 — Backend Laravel

```bash
composer create-project laravel/laravel backend
cd backend
composer require laravel/sanctum laravel/reverb barryvdh/laravel-dompdf
php artisan install:api
php artisan reverb:install
```

### .env da configurare
```env
APP_NAME="Gestione Comande"
APP_URL=http://localhost:8000

DB_CONNECTION=mariadb
DB_HOST=mariadb
DB_PORT=3306
DB_DATABASE=gestione_comande
DB_USERNAME=comande
DB_PASSWORD=secret

QUEUE_CONNECTION=database
CACHE_DRIVER=database

BROADCAST_CONNECTION=reverb

REVERB_APP_ID=gestione-comande
REVERB_APP_KEY=comande-key
REVERB_APP_SECRET=comande-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

SANCTUM_STATEFUL_DOMAINS=localhost:5173
```

### CORS — config/cors.php
```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_origins' => ['http://localhost:5173'],
'allowed_methods' => ['*'],
'allowed_headers' => ['*'],
'supports_credentials' => true,
```

### routes/api.php
```php
<?php
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public
    Route::post('auth/login', [AuthController::class, 'login']);

    // Authenticated
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/refresh', [AuthController::class, 'refresh']);
        Route::post('auth/force-logout/{user}', [AuthController::class, 'forceLogout'])
            ->middleware('role:admin');

        // Tutti gli altri endpoint vengono aggiunti dagli agenti successivi
        // Agente 03: menu (categories, dishes, ingredients, pizzas...)
        // Agente 04: zones, tables, orders...
        // Agente 06: users, printers, reports...
    });
});

// Health check
Route::get('v1/health', fn() => response()->json(['status' => 'ok']));
```

### Middleware Role — app/Http/Middleware/CheckRole.php
```php
<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole {
    public function handle(Request $request, Closure $next, string $role): mixed {
        if ($request->user()?->role !== $role) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return $next($request);
    }
}
```
Registrare in `bootstrap/app.php`: `->withMiddleware(function ($m) { $m->alias(['role' => CheckRole::class]); })`

### Trait LogsActivity — app/Traits/LogsActivity.php
```php
<?php
namespace App\Traits;

use App\Models\ActivityLog;

trait LogsActivity {
    protected function logActivity(string $action, string $description, $entity = null): void {
        ActivityLog::create([
            'user_id'     => auth()->id(),
            'action'      => $action,
            'description' => $description,
            'entity_type' => $entity ? class_basename($entity) : null,
            'entity_id'   => $entity?->id,
            'ip_address'  => request()->ip(),
        ]);
    }
}
```

### routes/channels.php
```php
<?php
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('orders.{orderId}', function ($user, $orderId) {
    return $user !== null;
});
Broadcast::channel('tables.{tableId}', function ($user) {
    return $user !== null;
});
Broadcast::channel('print-jobs.{jobId}', function ($user) {
    return $user !== null;
});
Broadcast::channel('admin.dashboard', function ($user) {
    return $user?->role === 'admin';
});
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
```

---

## Step 2 — Frontend React PWA

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install axios react-router-dom @tanstack/react-query zustand
npm install laravel-echo pusher-js
npm install tailwindcss @tailwindcss/forms autoprefixer postcss
npm install vite-plugin-pwa workbox-window
npx tailwindcss init -p
```

### vite.config.js
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Gestione Comande',
        short_name: 'Comande',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#ffffff',
        theme_color: '#1a56a0',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        runtimeCaching: [
          { urlPattern: /\/api\/v1\//, handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 5 } },
          { urlPattern: /\.(js|css|png|svg)$/, handler: 'CacheFirst',
            options: { cacheName: 'assets-cache' } }
        ]
      }
    })
  ],
  server: {
    proxy: { '/api': 'http://localhost:8000' }
  }
})
```

### src/api/axios.js
```js
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
```

### src/store/useAuthStore.js
```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/axios'

export const useAuthStore = create(persist(
  (set) => ({
    user: null,
    token: null,
    login: async (username, password) => {
      const { data } = await api.post('/auth/login', { username, password })
      localStorage.setItem('auth_token', data.token)
      set({ user: data.user, token: data.token })
    },
    logout: async () => {
      try { await api.post('/auth/logout') } catch {}
      localStorage.removeItem('auth_token')
      set({ user: null, token: null })
    }
  }),
  { name: 'auth-store' }
))
```

### src/echo.js
```js
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY || 'comande-key',
  wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
  wsPort: import.meta.env.VITE_REVERB_PORT || 8080,
  wssPort: import.meta.env.VITE_REVERB_PORT || 8080,
  forceTLS: false,
  enabledTransports: ['ws', 'wss'],
  authEndpoint: '/api/v1/broadcasting/auth',
  auth: {
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
  }
})

export default echo
```

---

## Step 3 — Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: ./backend
    volumes:
      - ./backend:/var/www/html
    networks: [comande]
    depends_on: [mariadb]

  nginx:
    image: nginx:alpine
    ports: ["8000:80"]
    volumes:
      - ./backend:/var/www/html
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    networks: [comande]

  mariadb:
    image: mariadb:11.4
    environment:
      MARIADB_DATABASE: gestione_comande
      MARIADB_USER: comande
      MARIADB_PASSWORD: secret
      MARIADB_ROOT_PASSWORD: rootsecret
    volumes: [mariadb_data:/var/lib/mysql]
    networks: [comande]

  reverb:
    build: ./backend
    command: php artisan reverb:start --host=0.0.0.0 --port=8080
    ports: ["8080:8080"]
    volumes: [./backend:/var/www/html]
    networks: [comande]

  queue:
    build: ./backend
    command: php artisan queue:work --sleep=3 --tries=3 --timeout=60
    volumes: [./backend:/var/www/html]
    networks: [comande]

networks:
  comande: {}
volumes:
  mariadb_data: {}
```

---

## Criteri di completamento

- [ ] `GET /api/v1/health` restituisce `{ "status": "ok" }`
- [ ] `php artisan migrate` esegue senza errori (anche con tabella vuota)
- [ ] Frontend React si avvia su `localhost:5173`
- [ ] PWA manifest valido (verificabile con Lighthouse)
- [ ] CORS: frontend può chiamare backend senza errori
- [ ] WebSocket: `echo.js` si connette a Reverb senza errori in console
- [ ] Queue worker: `php artisan queue:work` parte e rimane in ascolto
- [ ] Middleware `role:admin` restituisce 403 se utente è waiter
- [ ] Trait `LogsActivity` utilizzabile nei controller con `$this->logActivity(...)`
