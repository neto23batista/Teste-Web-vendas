<?php

declare(strict_types=1);

use App\Services\JobQueueService;

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

$limit = isset($argv[1]) ? (int) $argv[1] : 25;
$result = (new JobQueueService())->process($limit);

echo 'PROCESSED ' . (int) $result['processed'] . PHP_EOL;
echo 'FAILED ' . (int) $result['failed'] . PHP_EOL;
