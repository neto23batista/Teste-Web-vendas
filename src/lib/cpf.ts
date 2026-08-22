export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Validação dos dois dígitos verificadores do CPF. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digitAt = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digitAt(9) === Number(cpf[9]) && digitAt(10) === Number(cpf[10]);
}
