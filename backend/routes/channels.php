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
    return in_array($user?->role, ['admin', 'super_admin', 'cashier'], true);
});

Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
