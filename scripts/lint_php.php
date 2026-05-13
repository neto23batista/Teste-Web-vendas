<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
$failed = 0;

foreach ($iterator as $file) {
    if (!$file->isFile() || $file->getExtension() !== 'php') {
        continue;
    }
    if (str_contains($file->getPathname(), DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR)) {
        continue;
    }
    $cmd = escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($file->getPathname());
    exec($cmd, $output, $code);
    if ($code !== 0) {
        $failed++;
        echo implode(PHP_EOL, $output) . PHP_EOL;
    }
}

if ($failed > 0) {
    echo "PHP lint failed in {$failed} files." . PHP_EOL;
    exit(1);
}

echo "PHP lint passed." . PHP_EOL;
