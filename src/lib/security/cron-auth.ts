import { timingSafeEqual } from "node:crypto";
import { isLiveProduction } from "@/lib/env";

/** Autoriza cron por bearer em tempo constante; sem segredo só libera dev/test. */
export function cronRequestAuthorized(request: Pick<Request, "headers">): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production" && !isLiveProduction();
  }

  const header = request.headers.get("authorization");
  if (!header) return false;
  const provided = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
