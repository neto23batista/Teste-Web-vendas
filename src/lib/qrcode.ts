/**
 * Geração do QR Code PIX a partir do copia-e-cola (payload EMV).
 *
 * O copia-e-cola (`qr.text` do PagBank) é a fonte da verdade e está SEMPRE
 * presente — então o QR é gerado aqui, no servidor, em vez de depender do
 * PagBank devolver um link de imagem PNG (que às vezes não vem). Assim a tela
 * de pagamento sempre mostra um QR escaneável.
 *
 * Roda só no servidor (import de `qrcode`, lib Node). Retorna o PNG em base64
 * SEM o prefixo `data:` — mesmo shape do fluxo antigo, que o componente
 * `PixPayment` consome como `data:image/png;base64,<...>`.
 */
import QRCode from "qrcode";

export async function qrPngBase64(text: string): Promise<string> {
  if (!text) return "";
  try {
    // Só margin e width divergem dos defaults da lib (PNG, nível M, preto/branco).
    const buf = await QRCode.toBuffer(text, { margin: 1, width: 512 });
    return buf.toString("base64");
  } catch {
    // sem QR, o copia-e-cola continua funcionando
    return "";
  }
}
