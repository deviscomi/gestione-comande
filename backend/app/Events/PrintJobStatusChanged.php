<?php

namespace App\Events;

use App\Models\PrintJob;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PrintJobStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public PrintJob $printJob) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("print-jobs.{$this->printJob->id}")];
    }

    public function broadcastAs(): string
    {
        return 'print.status';
    }

    public function broadcastWith(): array
    {
        return [
            'job_id'          => $this->printJob->id,
            'print_type'      => $this->printJob->print_type,
            'status'          => $this->printJob->status,
            'attempts'        => $this->printJob->attempts,
            'pdf_backup_path' => $this->printJob->pdf_backup_path,
        ];
    }
}
