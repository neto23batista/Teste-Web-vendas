export const MAX_USER_ADDRESSES = 20;

export type NormalizedAddress = {
  label: string;
  recipient: string;
  zip: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  isDefault: boolean;
};

export function addressFromFormData(fd: FormData): NormalizedAddress {
  const value = (key: string) => String(fd.get(key) ?? "").trim();
  return {
    label: value("label") || "Endereço",
    recipient: value("recipient"),
    zip: value("zip").replace(/\D/g, ""),
    street: value("street"),
    number: value("number"),
    complement: value("complement") || null,
    district: value("district"),
    city: value("city"),
    state: value("state").toUpperCase().slice(0, 2),
    isDefault: fd.get("isDefault") === "on",
  };
}

export function validateAddress(address: NormalizedAddress): string | null {
  if (
    !address.recipient ||
    !address.zip ||
    !address.street ||
    !address.number ||
    !address.district ||
    !address.city ||
    !address.state
  ) {
    return "Preencha todos os campos obrigatórios do endereço.";
  }
  if (!/^\d{8}$/.test(address.zip)) return "Informe um CEP válido com 8 dígitos.";
  if (!/^[A-Z]{2}$/.test(address.state)) return "Informe uma UF válida com 2 letras.";
  if (address.recipient.length < 3 || address.recipient.length > 120) {
    return "Informe um nome de destinatário válido.";
  }
  if (
    address.label.length > 40 ||
    address.street.length > 160 ||
    address.number.length > 30 ||
    (address.complement?.length ?? 0) > 120 ||
    address.district.length > 100 ||
    address.city.length > 100
  ) {
    return "Um ou mais campos do endereço excedem o tamanho permitido.";
  }
  return null;
}
