import { expect, test } from "@playwright/test";

test("states the product promise and opens the salon story", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Explain it once. Your company remembers." }),
  ).toBeVisible();
  await expect(page.getByText(/turns everyday owner conversations into human-approved company knowledge/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /See the salon remember/i })).toHaveAttribute("href", "/chat?assistant=MARKETING");
});
