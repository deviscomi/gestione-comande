FROM php:8.3-fpm

# System dependencies
RUN apt-get update && apt-get install -y \
    git curl zip unzip libpng-dev libonig-dev libxml2-dev libzip-dev \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy application files
COPY . .

# Ensure required directories exist before composer runs post-install scripts
RUN mkdir -p bootstrap/cache storage/framework/{sessions,views,cache/data} storage/logs \
    && chmod -R 775 bootstrap/cache storage

# Install dependencies.
# Retry + fallback su sorgente git: i download "dist" da codeload.github.com a volte
# restituiscono HTTP 400 in modo transitorio e farebbero fallire l'intero build.
RUN composer update --no-interaction --optimize-autoloader --prefer-dist \
    || composer update --no-interaction --optimize-autoloader --prefer-dist \
    || composer update --no-interaction --optimize-autoloader --prefer-source

# Permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php-fpm"]
