<?php
declare(strict_types=1);

/** Router REST mínimo: método + patrón con {id} + roles permitidos. */
final class Router
{
    public const PUBLIC = 'public';
    private array $routes = [];

    /** @param string|array|null $roles 'public' | null (cualquier autenticado) | [roles] */
    public function add(string $method, string $pattern, callable $handler, string|array|null $roles = null): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', rtrim($pattern, '/')) . '/?$#';
        $this->routes[] = [$method, $regex, $handler, $roles];
    }

    public function get(string $p, callable $h, string|array|null $r = null): void { $this->add('GET', $p, $h, $r); }
    public function post(string $p, callable $h, string|array|null $r = null): void { $this->add('POST', $p, $h, $r); }
    public function put(string $p, callable $h, string|array|null $r = null): void { $this->add('PUT', $p, $h, $r); }
    public function patch(string $p, callable $h, string|array|null $r = null): void { $this->add('PATCH', $p, $h, $r); }
    public function delete(string $p, callable $h, string|array|null $r = null): void { $this->add('DELETE', $p, $h, $r); }

    public function dispatch(Request $req): never
    {
        $pathMatched = false;
        foreach ($this->routes as [$method, $regex, $handler, $roles]) {
            if (!preg_match($regex, $req->path, $m)) continue;
            $pathMatched = true;
            if ($method !== $req->method) continue;

            $req->params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);

            // 1) CSRF para operaciones que modifican datos (excepto login/registro públicos)
            if ($req->method !== 'GET' && $roles !== self::PUBLIC) Auth::verifyCsrf();
            // 2) Autenticación y 3) autorización por rol
            if ($roles !== self::PUBLIC) Auth::require($roles);

            $handler($req);
            Response::json(['ok' => true]); // por si el handler no respondió
        }
        if ($pathMatched) Response::error('Método HTTP no permitido para este recurso.', 405);
        Response::error('Endpoint no encontrado.', 404);
    }
}
