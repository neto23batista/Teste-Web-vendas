import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccess } from "@/lib/permissions";
import { getObject } from "@/lib/storage";
import { CONTENT_TYPE_BY_EXT } from "@/lib/uploads";

// Serve uma receita (dado sensível/LGPD) apenas para o próprio paciente ou para
// o staff que tem a área "receitas" NA UNIDADE do pedido. O arquivo fica em
// storage privado — nunca em /public.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const prescription = await prisma.prescription.findUnique({
    where: { id },
    select: {
      userId: true,
      fileUrl: true,
      order: { select: { pharmacyId: true } },
    },
  });
  if (!prescription) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  if (prescription.userId !== user.id) {
    // Não é o paciente: só passa staff com a área "receitas" (farmacêutico/dono).
    // Antes bastava `role === "ADMIN"` — qualquer perfil (até estoquista) baixava
    // a receita de qualquer cliente, de qualquer unidade.
    if (user.role !== "ADMIN" || !canAccess(user.staffProfile, "receitas")) {
      return new NextResponse("Acesso negado", { status: 403 });
    }
    // Escopo de unidade: filial só lê receita de pedido da PRÓPRIA unidade.
    const unit = prescription.order?.pharmacyId;
    const isGlobal = user.pharmacyType === "MATRIZ";
    if (!isGlobal && unit && user.pharmacyId !== unit) {
      return new NextResponse("Acesso negado", { status: 403 });
    }
  }

  let data: Buffer;
  try {
    data = await getObject(prescription.fileUrl);
  } catch {
    return new NextResponse("Arquivo indisponível", { status: 404 });
  }

  const ext = path.extname(prescription.fileUrl).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="receita${ext}"`,
      "Cache-Control": "private, no-store, max-age=0",
      // O tipo é derivado do MIME no upload, mas o conteúdo vem do usuário:
      // impede o navegador de "adivinhar" outro tipo (anti content-sniffing/XSS).
      "X-Content-Type-Options": "nosniff",
    },
  });
}
