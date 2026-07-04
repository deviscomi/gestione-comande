<?php
chdir('/var/www/html');
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::create(
    '/api/v1/auth/login', 'POST',
    ['username' => 'admin', 'password' => 'admin123'],
    [], [], ['HTTP_ACCEPT' => 'application/json', 'HTTP_HOST' => 'localhost']
);
$response = $kernel->handle($request);
echo "STATUS: " . $response->getStatusCode() . "\n";
echo $response->getContent() . "\n";
