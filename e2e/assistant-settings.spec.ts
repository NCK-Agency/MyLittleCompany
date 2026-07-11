import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, name: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login-demo");
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await expect(page).toHaveURL(/\/workspace/);
}

test("owner selects a persistent assistant tier and reset restores Balanced", async ({ page }) => {
  await signIn(page, "Maya");
  expect((await page.request.post("/api/demo/reset")).status()).toBe(200);
  await page.goto("/workspace#assistant-settings");
  await page.reload();

  const settings = page.locator("#assistant-settings");
  await expect(settings).toBeVisible();
  await expect(settings.getByRole("radio", { name: /^Balanced/ })).toBeChecked();

  await settings.getByRole("radio", { name: /^Best quality/ }).check();
  await settings.getByRole("button", { name: "Save choice" }).click();
  await expect(settings.getByText("Assistant choice saved. Your next request will use it.")).toBeVisible();
  await expect(settings.getByRole("radio", { name: /^Best quality/ })).toBeChecked();

  await page.reload();
  await expect(page.locator("#assistant-settings").getByRole("radio", { name: /^Best quality/ })).toBeChecked();
  const saved = await page.request.get("/api/company/assistant-settings");
  expect(saved.status()).toBe(200);
  expect((await saved.json()).data).toMatchObject({ modelTier: "BEST" });

  expect((await page.request.post("/api/demo/reset")).status()).toBe(200);
  await page.reload();
  await expect(page.locator("#assistant-settings").getByRole("radio", { name: /^Balanced/ })).toBeChecked();

  await signIn(page, "Lina");
  await expect(page.locator("#assistant-settings")).toHaveCount(0);
  expect((await page.request.get("/api/company/assistant-settings")).status()).toBe(403);
  expect((await page.request.patch("/api/company/assistant-settings", {
    data: { modelTier: "FAST" },
  })).status()).toBe(403);
});
