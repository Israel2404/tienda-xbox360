<?php
declare(strict_types=1);

final class Response
{
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        exit;
    }

    public static function created(mixed $data): never { self::json($data, 201); }

    public static function error(string $message, int $status, array $errors = []): never
    {
        $body = ['error' => true, 'mensaje' => $message, 'codigo' => $status];
        if ($errors) $body['errores'] = $errors;
        self::json($body, $status);
    }
}
