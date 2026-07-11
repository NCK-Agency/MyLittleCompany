import { expect, test } from "@playwright/test";

test("states the product promise and sends public interest to the waitlist", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Explain it once. Your company remembers." }),
  ).toBeVisible();
  await expect(page.getByText("Demo mode", { exact: true })).toBeVisible();
  await expect(page.getByText(/turn everyday owner conversations into approved company knowledge/i)).toBeVisible();
  await expect(page.getByText(/salon/i)).toHaveCount(0);
  const primaryWaitlistLinks = page.locator("main").getByRole("link", { name: "Join the waitlist" });
  await expect(primaryWaitlistLinks).toHaveCount(3);
  await expect(primaryWaitlistLinks.first()).toBeVisible();
  await expect(primaryWaitlistLinks.first()).toHaveAttribute("href", "/waitlist");
  await expect(primaryWaitlistLinks.first()).toHaveCSS("min-height", "60px");
  await expect(page.getByRole("link", { name: /Open demo controls/i })).toHaveCount(0);
});

test("puts new visitors on the waitlist without exposing account creation", async ({ page }) => {
  await page.goto("/");

  const headerWaitlistLink = page.locator("header").getByRole("link", { name: "Join the waitlist" });
  await expect(headerWaitlistLink).toBeVisible();
  await expect(page.getByRole("link", { name: /create.*account/i })).toHaveCount(0);
  await headerWaitlistLink.click();
  await expect(page).toHaveURL(/\/waitlist$/);

  await page.getByLabel("Work email").fill("new-owner@example.com");
  await page.getByLabel(/Your name/).fill("New Owner");
  await page.getByRole("button", { name: "Join the waitlist" }).click();

  await expect(page.getByRole("status")).toContainText("You’re on the waitlist");
  await expect(page.getByText(/Joining the waitlist does not create an account/i)).toBeVisible();
});

test("uses email for company sign in and keeps seeded demo access separate", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in securely" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Maya/i })).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open demo access" })).toHaveCount(0);
  await expect(page.getByText(/does not see or store your password/i)).toHaveCount(0);
  await expect(page.getByText(/secure sign-in is not enabled in this demo/i)).toHaveCount(0);

  await page.goto("/login-demo");
  await expect(page.getByRole("heading", { name: "Choose a demo account" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Maya.*OWNER/i })).toBeVisible();
  await expect(page.getByText("No password is required.")).toBeVisible();
});
