import { z } from "zod";

export const dataExportStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("NONE") }),
  z.object({ status: z.literal("PENDING"), requestedAt: z.iso.datetime() }),
  z.object({ status: z.literal("READY"), readyAt: z.iso.datetime(), expiresAt: z.iso.datetime(), sizeBytes: z.number().nonnegative().nullable() }),
  z.object({ status: z.literal("FAILED"), error: z.unknown().optional().transform(() => "A geração não foi concluída. Solicite novamente.") }),
  z.object({ status: z.literal("EXPIRED"), error: z.unknown().optional().transform(() => "O arquivo anterior expirou. Solicite novamente.") }),
]);
export type ExportState = z.infer<typeof dataExportStateSchema>;
export const dataExportRequestSchema = z.object({
  status: z.enum(["PENDING", "READY", "FAILED", "EXPIRED"]), requestedAt: z.iso.datetime().optional(),
});
