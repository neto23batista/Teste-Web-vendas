/**
 * Migration que deve ser a mais recente antes de uma instância receber tráfego.
 *
 * Precisa acompanhar a última pasta de `prisma/migrations`. O `/api/ready`
 * compara este valor com a migration efetivamente aplicada no banco, então
 * deixá-lo para trás inverte o sinal: depois de um release aplicado
 * corretamente, o readiness passaria a recusar tráfego para sempre.
 *
 * `__tests__/readiness.test.ts` falha se os dois divergirem — a constante não
 * depende de alguém lembrar de atualizá-la junto com a migration.
 */
export const EXPECTED_MIGRATION =
  "20260902000600_data_export_requests" as const;
