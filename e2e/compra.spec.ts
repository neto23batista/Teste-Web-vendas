import { test, expect } from "@playwright/test";
import { login, ALLOW_WRITES } from "./helpers";

test.describe("Fluxo de compra", () => {
  // Cria pedido de verdade — só com banco descartável/autorizado.
  test.skip(!ALLOW_WRITES, "escreve no banco — rode com E2E_ALLOW_WRITES=1");

  test("compra com pagamento em dinheiro até a página do pedido", async ({
    page,
  }) => {
    await login(page);

    // Catálogo: escolhe um produto SEM receita e em estoque para evitar a
    // exigência de upload de receita no checkout.
    await page.goto("/catalogo");
    const card = page
      .locator("article")
      .filter({ hasNotText: "Receita" })
      .filter({ hasNotText: "Sem estoque" })
      .first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    // exact: o card também tem o coração "Adicionar aos favoritos".
    await card.getByRole("button", { name: "Adicionar", exact: true }).click();
    // Confirmação do toast de adição.
    await expect(page.getByText("Adicionado à sacola")).toBeVisible({
      timeout: 30_000,
    });

    // Checkout: usa o endereço padrão (seed) e paga em dinheiro.
    await page.goto("/checkout");
    await expect(
      page.getByRole("button", { name: "Finalizar pedido" })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByText("Dinheiro na entrega").click();
    await page.getByRole("button", { name: "Finalizar pedido" }).click();

    // Deve chegar na página do pedido.
    await expect(page).toHaveURL(/\/pedido\/FV/, { timeout: 45_000 });
    await expect(page.getByText(/Pedido/i).first()).toBeVisible();
  });
});
