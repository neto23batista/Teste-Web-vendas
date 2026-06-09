import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getObject } from "@/lib/storage";
import { CONTENT_TYPE_BY_EXT } from "@/lib/uploads";

// Serve uma receita (dado sensível/LGPD) apenas para o dono ou um admin.
// O arquivo fica em storage privado — nunca em /public.
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
  if (prescription.userId !== user.id && user.role !== "ADMIN") {
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
    },
  });
}
