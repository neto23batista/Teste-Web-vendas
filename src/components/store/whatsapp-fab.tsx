import { MessageCircle } from "lucide-react";

/**
 * Botão flutuante "falar com o farmacêutico" via WhatsApp. Renderiza só quando
 * a loja tem WhatsApp configurado (/admin/configuracoes). Server Component —
 * a expansão do rótulo no hover é 100% CSS (group-hover + max-width).
 */
export function WhatsAppFab({ whatsapp }: { whatsapp: string }) {
  const digits = whatsapp.replace(/\D/g, "");
  if (!digits) return null;
  // Números locais (10–11 dígitos) ganham o DDI do Brasil.
  const full = digits.length <= 11 ? `55${digits}` : digits;
  const text = encodeURIComponent(
    "Olá! Vim pelo site da FarmaVida e queria uma orientação farmacêutica."
  );

  return (
    <a
      href={`https://wa.me/${full}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o farmacêutico no WhatsApp"
      className="press group fixed bottom-24 right-4 z-40 flex items-center gap-0 rounded-full bg-gradient-to-br from-[#25d366] to-[#128c7e] p-3.5 text-white shadow-[0_12px_36px_-8px_rgba(18,140,126,0.55)] transition-all duration-300 hover:shadow-[0_16px_48px_-8px_rgba(18,140,126,0.7)] md:bottom-6 md:right-6 print:hidden"
    >
      <MessageCircle className="size-6 shrink-0" />
      {/* Rótulo que expande no hover (desktop). */}
      <span className="grid max-w-0 grid-flow-col items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm font-semibold transition-[max-width,margin] duration-300 group-hover:ml-2 group-hover:max-w-56 group-focus-visible:ml-2 group-focus-visible:max-w-56">
        <span className="glow-dot" aria-hidden />
        Farmacêutico online
      </span>
    </a>
  );
}
