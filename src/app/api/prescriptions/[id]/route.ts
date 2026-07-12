import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isOwnerProfile } from "@/lib/permissions";
import { getObject } from "@/lib/storage";
import { CONTENT_TYPE_BY_EXT } from "@/lib/uploads";

/**
 * A loja NÃO trabalha mais com receita: nada envia arquivo novo por aqui. A rota
 * continua de pé só para o HISTÓRICO — as receitas enviadas antes da remoção
 * seguem no banco e precisam ser acessíveis (LGPD: o titular tem direito aos
 * próprios dados). Acesso: o próprio paciente, ou o DONO da loja. O arquivo fica
 * em storage privado — nunca em /public.
 */
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
    select: { userId: true, fileUrl: true },
  });
  if (!prescription) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const isPatient = prescription.userId === user.id;
  const isStoreOwner = user.role === "ADMIN" && isOwnerProfile(user.staffProfile);
  if (!isPatient && !isStoreOwner) {
    return new NextResponse("Acesso negado", { status: 403 });
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
