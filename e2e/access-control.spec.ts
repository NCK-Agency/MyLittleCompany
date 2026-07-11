import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, name: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login-demo");
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await expect(page).toHaveURL(/\/workspace/);
}

test("shows navigation and administration for the signed-in grant set", async ({ page }) => {
  await page.context().clearCookies();
  expect((await page.request.get("/api/company")).status()).toBe(401);
  await signIn(page, "Maya");
  await expect(page.getByRole("link", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Playbook", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "People & access" }).click();
  await expect(page.getByRole("heading", { name: "Give people only what they need." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Minh", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "An", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lina", exact: true })).toBeVisible();

  await signIn(page, "Minh");
  await expect(page.getByRole("link", { name: "Review", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Playbook", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suggest knowledge" })).toBeVisible();
  const forbiddenReview = await page.request.get("/api/memory-candidates");
  expect(forbiddenReview.status()).toBe(403);

  await signIn(page, "An");
  await expect(page.getByRole("link", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Playbook", exact: true })).toBeVisible();

  await signIn(page, "Lina");
  await expect(page.getByRole("link", { name: "Review", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Playbook", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suggest knowledge" })).toHaveCount(0);
});
