// Consulta de CEP via ViaCEP (gratuito, sem chave). Client-safe.
// Retorna null em CEP inválido, não encontrado ou falha de rede.

export type CepResult = {
  street: string;
  district: string;
  city: string;
  state: string;
};

export async function lookupCep(cepRaw: string): Promise<CepResult | null> {
  const cep = cepRaw.replace(/\D/g, "");
  if (cep.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
