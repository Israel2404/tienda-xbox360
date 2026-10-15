<?php
declare(strict_types=1);

/** Error controlado que se convierte en respuesta JSON con su código HTTP. */
class HttpException extends RuntimeException
{
    public function __construct(string $message, public int $status = 400, public array $errors = [])
    {
        parent::__construct($message, $status);
    }

    public static function badRequest(string $m = 'Solicitud incorrecta.'): self { return new self($m, 400); }
    public static function unauthorized(string $m = 'Debes iniciar sesión.'): self { return new self($m, 401); }
    public static function forbidden(string $m = 'No tienes permisos para realizar esta operación.'): self { return new self($m, 403); }
    public static function notFound(string $m = 'El recurso solicitado no existe.'): self { return new self($m, 404); }
    public static function conflict(string $m): self { return new self($m, 409); }
    public static function validation(array $errors, string $m = 'Revisa los datos capturados.'): self { return new self($m, 422, $errors); }
}
