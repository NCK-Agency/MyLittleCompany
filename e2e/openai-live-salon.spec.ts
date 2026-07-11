import { expect, test, type Page } from "@playwright/test";

const liveOpenAI = process.env.MODEL_PROVIDER === "openai";
const tiers = [
  { tier: "FAST", label: "Fast" },
  { tier: "BALANCED", label: "Balanced" },
  { tier: "BEST", label: "Best quality" },
] as const;

async function signInAsOwner(page: Page): Promise<void> {
  await page.goto("/login-demo");
  await page.getByRole("button", { name: /Maya.*OWNER/i }).click();
  await expect(page).toHaveURL(/\/workspace/);
}

for (const selection of tiers) {
  test(`completes the live OpenAI salon loop with ${selection.label}`, async ({ page }) => {
    test.skip(!liveOpenAI, "Requires MODEL_PROVIDER=openai and a server-only OPENAI_API_KEY.");
    test.setTimeout(240_000);

    await signInAsOwner(page);
    expect((await page.request.post("/api/demo/reset")).status()).toBe(200);
    const updated = await page.request.patch("/api/company/assistant-settings", {
      data: { modelTier: selection.tier },
    });
    expect(updated.status()).toBe(200);
    expect((await updated.json()).data).toMatchObject({ modelTier: selection.tier });

    await page.goto("/chat?assistant=MARKETING");
    const marketing = page.getByLabel("Message Marketing");
    await marketing.fill("Tuesdays are quiet. Create a promotion to bring more customers in.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator(".mlc-assistant-message").last()).toBeVisible({ timeout: 90_000 });

    await marketing.fill(
      "We never discount more than 15%. We prefer a complimentary add-on because we want to protect margins and our premium image.",
    );
    await page.getByRole("button", { name: "Send" }).click();

    const candidate = page.getByTestId("candidate-card").filter({ hasText: /15%/ }).last();
    await expect(candidate).toBeVisible({ timeout: 120_000 });
    await expect(candidate).toContainText(/15%/);
    await expect(candidate).toContainText(/complimentary|add-on|add on/i);
    await candidate.getByRole("button", { name: "Approve" }).click();
    await expect(candidate).toContainText("Approved and ready in the Playbook.");

    await marketing.fill(
      "Create the Tuesday promotion using our approved 15% discount rule and complimentary add-on preference.",
    );
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/complimentary|free add-on/i).last()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/Source · .*15%/)).toBeVisible();

    await page.getByRole("button", { name: /Operations/ }).click();
    const operations = page.getByLabel("Message Operations");
    await operations.fill(
      "Create a Tuesday promotion SOP that follows the approved 15% discount rule and complimentary add-on preference.",
    );
    await page.getByRole("button", { name: "Send to Operations" }).click();
    await expect(page.getByTestId("sop-draft")).toContainText(/15%|complimentary/i, { timeout: 90_000 });

    await page.getByRole("button", { name: /Employee/ }).click();
    await page.getByLabel("Ask a company question").fill("Can I give a customer 25% off?");
    await page.getByRole("button", { name: "Ask the Playbook" }).click();
    const answer = page.getByTestId("employee-answer");
    await expect(answer).toContainText(/No/i, { timeout: 90_000 });
    await expect(answer).toContainText("15%");
    await expect(answer).toContainText(/Source ·/);
  });
}
