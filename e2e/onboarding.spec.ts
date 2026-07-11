import { expect, test } from "@playwright/test";

async function signInAsOwner(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /Maya.*OWNER/i }).click();
  await expect(page).toHaveURL(/\/workspace/);
  await page.request.post("/api/demo/reset");
}

async function startOnboarding(page: import("@playwright/test").Page, question: string): Promise<void> {
  await page.goto("/workspace");
  await page.getByRole("link", { name: "Bring in company context" }).click();
  await page.getByLabel("Your question").fill(question);
  await page.getByRole("button", { name: /Choose context/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/source\//);
}

async function approveAndProve(page: import("@playwright/test").Page): Promise<void> {
  const candidate = page.getByTestId("candidate-card");
  await expect(candidate).toContainText("15%");
  await candidate.getByRole("button", { name: "Approve" }).click();
  const proveButton = page.getByRole("button", { name: /Prove it now|Ask the proof question/ });
  await expect(proveButton).toBeVisible();
  await proveButton.click();
  await expect(page).toHaveURL(/\/onboarding\/prove\//);
  await expect(page.getByText(/must not exceed 15%|maximum.*15%/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /approved/i })).toBeVisible();
  await expect(page.locator(".onboarding-search-state")).toContainText(/Ready|Updating|Needs attention/);
}

test("owner proves approved knowledge from pasted context", async ({ page }) => {
  await signInAsOwner(page);
  await startOnboarding(page, "Can the front desk offer a customer 25% off?");

  await page.getByLabel("Source title").fill("Pricing conversation");
  await page.getByLabel("Paste the useful conversation or notes").fill(
    "Owner: We never discount more than 15%. We prefer complimentary add-ons because we want to protect our premium positioning.",
  );
  await page.getByRole("button", { name: /Use this context/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/review\//, { timeout: 30_000 });
  await approveAndProve(page);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("ChatGPT export stays local until one conversation is selected", async ({ page }) => {
  await signInAsOwner(page);
  await startOnboarding(page, "What is our maximum promotional discount?");
  await page.getByRole("tab", { name: "ChatGPT export" }).click();

  const exportData = [
    {
      id: "irrelevant-conversation",
      title: "Private holiday planning",
      update_time: 1,
      current_node: "private-assistant",
      mapping: {
        "private-user": {
          id: "private-user",
          parent: null,
          message: { author: { role: "user" }, content: { parts: ["Book a personal trip."] } },
        },
        "private-assistant": {
          id: "private-assistant",
          parent: "private-user",
          message: { author: { role: "assistant" }, content: { parts: ["Here is an itinerary."] } },
        },
      },
    },
    {
      id: "pricing-conversation",
      title: "Promotion policy",
      update_time: 2,
      current_node: "pricing-assistant",
      mapping: {
        "pricing-user": {
          id: "pricing-user",
          parent: null,
          message: {
            author: { role: "user" },
            content: { parts: ["Our promotions must never exceed a 15% discount. Offer a free add-on instead."] },
          },
        },
        "pricing-assistant": {
          id: "pricing-assistant",
          parent: "pricing-user",
          message: { author: { role: "assistant" }, content: { parts: ["I will follow that pricing rule."] } },
        },
      },
    },
  ];

  await page.getByLabel("Choose extracted conversations.json").setInputFiles({
    name: "conversations.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exportData)),
  });
  await expect(page.getByText(/Found 2 conversations/)).toBeVisible();
  await page.getByRole("combobox", { name: "Conversation" }).selectOption("pricing-conversation");
  await page.getByRole("button", { name: /Use this context/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/review\//, { timeout: 30_000 });
  await expect(page.getByTestId("candidate-card")).not.toContainText("holiday");
  await approveAndProve(page);
});
