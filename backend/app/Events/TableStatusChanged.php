<?php

namespace App\Events;

use App\Models\Table;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TableStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Table $table) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tables.{$this->table->id}"),
            new PrivateChannel('admin.dashboard'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'table.status';
    }

    public function broadcastWith(): array
    {
        return [
            'table_id' => $this->table->id,
            'number'   => $this->table->number,
            'suffix'   => $this->table->suffix,
            'zone_id'  => $this->table->zone_id,
            'status'   => $this->table->status,
        ];
    }
}
