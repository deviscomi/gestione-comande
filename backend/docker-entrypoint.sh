#!/bin/bash
set -e

# Fix permissions on mounted volumes (runs as root before php-fpm drops to www-data)
mkdir -p bootstrap/cache \
         storage/framework/sessions \
         storage/framework/views \
         storage/framework/cache/data \
         storage/logs
chmod -R 775 bootstrap/cache storage
chown -R www-data:www-data bootstrap/cache storage

# Write APP_KEY to .env if provided via environment
if [ -n "$APP_KEY" ]; then
    sed -i "s|^APP_KEY=.*|APP_KEY=${APP_KEY}|" .env
elif grep -q "^APP_KEY=$" .env; then
    php artisan key:generate --force
fi

# Wait for MariaDB (PDO usa il driver pdo_mysql, compatibile anche con MariaDB)
until php -r "new PDO('mysql:host=${DB_HOST};port=${DB_PORT};dbname=${DB_DATABASE}', '${DB_USERNAME}', '${DB_PASSWORD}');" 2>/dev/null; do
    echo "Waiting for MariaDB..."
    sleep 2
done

# Migrazioni e seed: SOLO il container designato (RUN_MIGRATIONS=true, cioè 'app').
# app/reverb/queue condividono lo stesso entrypoint: se migrassero tutti in parallelo
# su un DB vuoto andrebbero in race condition ("table already exists" / schema a metà).
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force

    # Seed solo su installazione pulita (tabella users vuota)
    USER_COUNT=$(php artisan tinker --execute="echo App\Models\User::count();" 2>/dev/null | tail -1)
    if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
        php artisan db:seed --force
    fi
else
    # Gli altri container attendono che 'app' abbia completato migrazioni + seed
    # (users popolata ⇒ schema completo e dati pronti) prima di avviare il loro processo.
    until php -r "\$db = new PDO('mysql:host=${DB_HOST};port=${DB_PORT};dbname=${DB_DATABASE}', '${DB_USERNAME}', '${DB_PASSWORD}'); exit(\$db->query('select count(*) from users')->fetchColumn() > 0 ? 0 : 1);" 2>/dev/null; do
        echo "Waiting for migrations & seed..."
        sleep 2
    done
fi

# Cache config in production
if [ "$APP_ENV" = "production" ]; then
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

exec "$@"
