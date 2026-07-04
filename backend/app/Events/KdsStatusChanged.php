<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class KdsStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $department,
        public readonly string $eventType,
        public readonly array  $payload
    ) {}

    public function broadcastOn(): array
    {
        // Canale pubblico — i display KDS non si autenticano
        return [new Channel('kds-updates')];
    }

    public function broadcastAs(): string
    {
        return 'kds.update';
    }

    public function broadcastWith(): array
    {
        return [
            'department' => $this->department,
            'eventType'  => $this->eventType,
            'payload'    => $this->payload,
        ];
    }
}
