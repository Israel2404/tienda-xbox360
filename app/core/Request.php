<?php
declare(strict_types=1);

final class Request
{
    public string $method;
    public string $path;
    public array $params = [];   // parámetros de ruta {id}
    private ?array $body = null;

    public function __construct(string $path)
    {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $this->path = '/' . trim($path, '/');
    }

    /** Cuerpo JSON. Lanza 400 si el JSON está mal formado. */
    public function body(): array
    {
        if ($this->body !== null) return $this->body;
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_starts_with($ct, 'multipart/form-data')) return $this->body = $_POST;
        $raw = file_get_contents('php://input') ?: '';
        if (trim($raw) === '') return $this->body = [];
        if (strlen($raw) > 1_000_000) throw HttpException::badRequest('El cuerpo de la petición es demasiado grande.');
        $data = json_decode($raw, true);
        if (!is_array($data)) throw HttpException::badRequest('El cuerpo debe ser un JSON válido.');
        return $this->body = $data;
    }

    public function query(string $key, ?string $default = null): ?string
    {
        $v = $_GET[$key] ?? $default;
        if (is_array($v)) return $default;
        $v = $v === null ? null : trim((string) $v);
        return $v === '' ? $default : $v;
    }

    public function id(): int
    {
        $id = filter_var($this->params['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$id) throw HttpException::badRequest('Identificador inválido.');
        return $id;
    }

    /** page y limit con límites seguros */
    public function pagination(int $defaultLimit = 10): array
    {
        $page  = max(1, (int) ($this->query('page', '1')));
        $limit = min(100, max(1, (int) ($this->query('limit', (string) $defaultLimit))));
        return [$page, $limit];
    }

    /** Ordenamiento contra lista blanca: ?sort=campo&dir=asc|desc */
    public function sort(array $allowed, string $default, string $defaultDir = 'asc'): string
    {
        $key = $this->query('sort', $default);
        $col = $allowed[$key] ?? $allowed[$default];
        $dir = strtolower($this->query('dir', $defaultDir)) === 'desc' ? 'DESC' : 'ASC';
        return "$col $dir";
    }

    public static function ip(): string
    {
        return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45);
    }
}
