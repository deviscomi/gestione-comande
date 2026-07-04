<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DailyClosureResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'closed_by'       => $this->closed_by,
            'closed_by_user'  => new UserResource($this->whenLoaded('closedBy')),
            'closed_at'       => $this->closed_at,
            'report_pdf_path' => $this->report_pdf_path,
            'is_locked'       => $this->is_locked,
            'notes'           => $this->notes,
            'report_url'      => $this->report_pdf_path
                ? "/api/v1/daily-closures/{$this->id}/report"
                : null,
        ];
    }
}
