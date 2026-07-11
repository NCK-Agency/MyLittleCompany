import { expect, test } from "@playwright/test";

test("states the product promise and opens the salon story", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Explain it once. Your company remembers." }),
  ).toBeVisible();
  await expect(page.getByText(/turns everyday owner conversations into human-approved company knowledge/i)).toBeVisible();
  const primaryDemoLink = page.getByRole("link", { name: /Start the live salon demo/i }).first();
  await expect(primaryDemoLink).toBeVisible();
  await expect(primaryDemoLink).toHaveAttribute("href", "/chat?assistant=MARKETING");
  await expect(primaryDemoLink).toHaveCSS("min-height", "60px");
});
