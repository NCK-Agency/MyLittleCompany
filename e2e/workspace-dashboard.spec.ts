import { expect, test } from "@playwright/test";

test("resumes the latest conversation from the company dashboard", async ({ page }) => {
  await page.goto("/login-demo");
  await page.getByRole("button", { name: /Maya.*OWNER/i }).click();
  await expect(page).toHaveURL(/\/workspace/);
  await page.request.post("/api/demo/reset");

  await page.goto("/chat?assistant=MARKETING");
  const composer = page.getByLabel("Message Marketing");
  await composer.fill("Plan a Tuesday promotion for our quiet day.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Recommendation:.*Tuesday/i)).toBeVisible();

  await page.goto("/workspace");
  await expect(page.getByText("Last active conversation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan a Tuesday promotion for our quiet day." })).toBeVisible();
  await expect(page.getByText(/approved entries available to you/i)).toBeVisible();

  const continueLink = page.getByRole("link", { name: /Continue conversation/ });
  await expect(continueLink).toHaveAttribute("href", /\/chat\?conversation=conversation-/);
  const newConversationLink = page.getByRole("link", { name: "New conversation" });
  await expect(newConversationLink).toHaveCSS("color", "rgb(18, 49, 138)");
  await expect(newConversationLink).toHaveCSS("background-color", "rgb(255, 253, 248)");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Plan a Tuesday promotion for our quiet day." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await continueLink.click();

  await expect(page).toHaveURL(/\/chat\?conversation=conversation-/);
  await expect(page.getByRole("heading", { name: "Plan a Tuesday promotion for our quiet day." })).toBeVisible();
  await expect(page.getByText(/Recommendation:.*Tuesday/i)).toBeVisible();
});
