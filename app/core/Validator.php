<?php
declare(strict_types=1);

/**
 * Validador de entradas del lado servidor.
 * Reglas: required, string, max:N, min:N, int, number, positive, email, date, in:a,b, bool
 */
final class Validator
{
    public static function check(array $data, array $rules): array
    {
        $errors = [];
        $clean = [];
        foreach ($rules as $field => $ruleStr) {
            $rules_ = explode('|', $ruleStr);
            $value = $data[$field] ?? null;
            if (is_string($value)) $value = trim($value);
            $isEmpty = $value === null || $value === '' || (is_array($value) && !$value);

            if ($isEmpty) {
                if (in_array('required', $rules_, true)) $errors[$field] = 'Este campo es obligatorio.';
                elseif (array_key_exists($field, $data)) $clean[$field] = null;
                continue;
            }
            $numeric = in_array('int', $rules_, true) || in_array('number', $rules_, true);
            foreach ($rules_ as $rule) {
                [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
                $err = match ($name) {
                    'string'   => is_string($value) ? null : 'Debe ser texto.',
                    'max'      => $numeric
                                  ? ((is_numeric($value) && $value > (float) $arg) ? "No puede ser mayor a $arg." : null)
                                  : ((is_string($value) && mb_strlen($value) > (int) $arg) ? "Máximo $arg caracteres." : null),
                    'min'      => $numeric
                                  ? ((is_numeric($value) && $value < (float) $arg) ? "Debe ser al menos $arg." : null)
                                  : ((is_string($value) && mb_strlen($value) < (int) $arg) ? "Mínimo $arg caracteres." : null),
                    'int'      => filter_var($value, FILTER_VALIDATE_INT) !== false ? null : 'Debe ser un número entero.',
                    'number'   => is_numeric($value) ? null : 'Debe ser un número.',
                    'positive' => (is_numeric($value) && $value > 0) ? null : 'Debe ser mayor a 0.',
                    'email'    => filter_var($value, FILTER_VALIDATE_EMAIL) ? null : 'Correo electrónico inválido.',
                    'date'     => self::isDate((string) $value) ? null : 'Fecha inválida (AAAA-MM-DD).',
                    'in'       => in_array((string) $value, explode(',', (string) $arg), true) ? null : 'Valor no permitido.',
                    'bool'     => in_array($value, [true, false, 0, 1, '0', '1'], true) ? null : 'Debe ser verdadero o falso.',
                    'password' => (mb_strlen((string) $value) >= 8 && preg_match('/[A-Za-z]/', (string) $value) && preg_match('/\d/', (string) $value))
                                  ? null : 'Mínimo 8 caracteres con letras y números.',
                    default    => null,
                };
                if ($err) { $errors[$field] = $err; break; }
            }
            if (!isset($errors[$field])) {
                if (in_array('int', $rules_, true)) $value = (int) $value;
                elseif (in_array('number', $rules_, true)) $value = (float) $value;
                elseif (in_array('bool', $rules_, true)) $value = (int) (bool) $value;
                elseif (is_string($value)) $value = strip_tags($value);   // sanitización básica
                $clean[$field] = $value;
            }
        }
        if ($errors) throw HttpException::validation($errors);
        return $clean;
    }

    public static function isDate(string $v): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $v);
        return $d && $d->format('Y-m-d') === $v;
    }

    /** Rango de fechas ?desde&hasta (por defecto últimos 30 días). */
    public static function dateRange(Request $req, int $defaultDays = 30): array
    {
        $hasta = $req->query('hasta', date('Y-m-d'));
        $desde = $req->query('desde', date('Y-m-d', strtotime("-" . ($defaultDays - 1) . " days")));
        $errors = [];
        if (!self::isDate($desde)) $errors['desde'] = 'Fecha inicial inválida.';
        if (!self::isDate($hasta)) $errors['hasta'] = 'Fecha final inválida.';
        if (!$errors && $desde > $hasta) $errors['desde'] = 'La fecha inicial no puede ser mayor que la final.';
        if (!$errors && (strtotime($hasta) - strtotime($desde)) > 366 * 86400) $errors['hasta'] = 'El rango máximo es de 1 año.';
        if ($errors) throw HttpException::validation($errors);
        return [$desde, $hasta];
    }
}
