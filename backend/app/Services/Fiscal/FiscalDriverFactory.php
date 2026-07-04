<?php

namespace App\Services\Fiscal;

use App\Services\Fiscal\Contracts\FiscalDriverInterface;
use App\Services\Fiscal\Drivers\CustomDriver;
use App\Services\Fiscal\Drivers\EpsonFpDriver;
use App\Services\Fiscal\Drivers\GenericBridgeDriver;
use App\Services\Fiscal\Drivers\GenericHttpDriver;
use App\Services\Fiscal\Drivers\RchWebserviceDriver;
use InvalidArgumentException;

class FiscalDriverFactory
{
    private const MAP = [
        'epson_fp'       => EpsonFpDriver::class,
        'custom'         => CustomDriver::class,
        'rch_webservice' => RchWebserviceDriver::class,
        'generic_http'   => GenericHttpDriver::class,
        'generic_bridge' => GenericBridgeDriver::class,
    ];

    public static function make(string $driver): FiscalDriverInterface
    {
        if (! isset(self::MAP[$driver])) {
            throw new InvalidArgumentException("Driver fiscale '{$driver}' non riconosciuto");
        }

        $class = self::MAP[$driver];

        return new $class();
    }
}
