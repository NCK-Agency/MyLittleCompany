import { expect, test } from "@playwright/test";

test("shows the deployable product foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "What are you working on today?" }),
  ).toBeVisible();
  await expect(page.getByText("Explain it once. Your company remembers.")).toBeVisible();
});
