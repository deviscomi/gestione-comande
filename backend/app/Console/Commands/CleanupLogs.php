<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\PrintJob;
use App\Models\SystemSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanupLogs extends Command
{
    protected $signature   = 'logs:cleanup {--months= : Mesi di retention (default: impostazione log_retention_months o 6)}';
    protected $description = 'Elimina activity log e PDF backup più vecchi del periodo di retention';

    public function handle(): int
    {
        // Priorità: opzione CLI → impostazione log_retention_months → default 6.
        $months = (int) ($this->option('months')
            ?? SystemSetting::where('key', 'log_retention_months')->value('value')
            ?? 6);
        if ($months < 1) $months = 6; // guardia: mai cancellare tutto per valori 0/negativi

        $cutoff = now()->subMonths($months);
        $this->info("Retention: {$months} mesi (cutoff {$cutoff->toDateString()})");

        $deleted = ActivityLog::where('created_at', '<', $cutoff)->delete();
        $this->info("Activity log eliminati: {$deleted}");

        $failedJobs = PrintJob::where('status', 'failed')
            ->whereNotNull('pdf_backup_path')
            ->where('created_at', '<', $cutoff)
            ->get();

        $pdfDeleted = 0;
        foreach ($failedJobs as $job) {
            if (Storage::exists($job->pdf_backup_path)) {
                Storage::delete($job->pdf_backup_path);
                $pdfDeleted++;
            }
            $job->update(['pdf_backup_path' => null]);
        }

        $this->info("PDF backup eliminati: {$pdfDeleted}");
        return Command::SUCCESS;
    }
}
