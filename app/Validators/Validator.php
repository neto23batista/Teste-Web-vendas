<?php

declare(strict_types=1);

namespace App\Validators;

final class Validator
{
    /** @var array<string, string> */
    private array $errors = [];

    public function required(array $data, array $fields): self
    {
        foreach ($fields as $field) {
            if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
                $this->errors[$field] = 'Campo obrigatorio.';
            }
        }
        return $this;
    }

    public function email(array $data, string $field): self
    {
        if (isset($data[$field]) && !filter_var((string) $data[$field], FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = 'E-mail invalido.';
        }
        return $this;
    }

    public function cpf(array $data, string $field): self
    {
        if (isset($data[$field]) && !valid_cpf((string) $data[$field])) {
            $this->errors[$field] = 'CPF invalido.';
        }
        return $this;
    }

    public function password(array $data, string $field): self
    {
        $value = (string) ($data[$field] ?? '');
        if (strlen($value) < 8 || !preg_match('/[A-Z]/', $value) || !preg_match('/[a-z]/', $value) || !preg_match('/\d/', $value)) {
            $this->errors[$field] = 'Senha deve ter no minimo 8 caracteres, maiuscula, minuscula e numero.';
        }
        return $this;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    /** @return array<string, string> */
    public function errors(): array
    {
        return $this->errors;
    }
}

