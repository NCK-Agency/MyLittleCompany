import { expect, test } from "@playwright/test";

async function signInAsOwner(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login-demo");
  await page.getByRole("button", { name: /Maya.*OWNER/i }).click();
  await expect(page).toHaveURL(/\/workspace/);
}

test("completes the governed salon memory loop", async ({ page }) => {
  const unexpectedExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      unexpectedExternalRequests.push(request.url());
    }
  });

  await signInAsOwner(page);
  await page.request.post("/api/demo/reset");
  await page.goto("/chat?assistant=MARKETING");

  const composer = page.getByLabel("Message Marketing");
  await composer.fill("Tuesdays are quiet. Create a promotion to bring more customers in.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(composer).toHaveValue("");
  await expect(page.getByText(/Recommendation:.*Tuesday/i)).toBeVisible();

  await composer.fill("We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.");
  await page.getByRole("button", { name: "Send" }).click();
  const candidate = page.getByTestId("candidate-card").filter({ hasText: "Promotional discounts must not exceed 15%" });
  await expect(candidate).toContainText("15%");
  const beforeApproval = await page.request.get("/api/memories");
  expect(JSON.stringify(await beforeApproval.json())).not.toContain("Promotional discounts must not exceed 15%");

  await candidate.getByRole("button", { name: "Approve" }).click();
  await expect(candidate).toContainText("Approved and ready in the Playbook.");

  await composer.fill("Please revise the Tuesday promotion using our approved company rules.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/complimentary|free add-on/i).last()).toBeVisible();
  await expect(page.getByText(/Source · .*15%/)).toBeVisible();

  await page.getByRole("button", { name: /^Context/ }).click();
  const contextPanel = page.getByRole("complementary", { name: "Conversation knowledge" });
  await expect(contextPanel).toBeVisible();
  await expect(contextPanel.getByText("Promotional discounts must not exceed 15%").first()).toBeVisible();
  await contextPanel.getByRole("button", { name: "Close conversation knowledge" }).click();

  await page.getByRole("button", { name: /Operations/ }).click();
  await page.getByRole("button", { name: "Generate Tuesday Promotion SOP" }).click();
  await expect(page.getByTestId("sop-draft")).toContainText(/Tuesday|promotion/i);
  await page.getByRole("button", { name: "Save for review" }).click();
  await expect(page.getByText("Saved for review. It is not approved yet.").last()).toBeVisible();

  await page.getByRole("button", { name: /Employee/ }).click();
  await page.getByLabel("Ask a company question").fill("Can I give a customer 25% off?");
  await page.getByRole("button", { name: "Ask the Playbook" }).click();
  const answer = page.getByTestId("employee-answer");
  await expect(answer).toContainText(/No/i);
  await expect(answer).toContainText("15%");
  await expect(answer).toContainText(/protect margins and premium positioning/i);
  await expect(answer).toContainText(/Source · .*15%/);
  await expect(answer).toContainText(/Approved \d/);

  await page.getByRole("button", { name: /Tuesdays are quiet.*Marketing/i }).click();
  await expect(page.getByLabel("Message Marketing")).toBeVisible();
  await expect(candidate).toContainText("15%");

  await page.getByRole("link", { name: "Knowledge", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Approved company knowledge" })).toBeVisible();
  await page.getByRole("button", { name: /Decisions & policies/ }).click();
  await expect(page.getByText(/15%/).last()).toBeVisible();

  await page.getByRole("link").filter({ hasText: "Promotional discounts must not exceed 15%" }).click();
  await page.getByRole("button", { name: "Edit entry" }).click();
  await page.getByLabel("Title").fill("Promotional discounts must not exceed 10%");
  await page.getByLabel("Company rule or knowledge").fill("Promotional discounts must not exceed 10%. Prefer complimentary add-ons over deeper discounts.");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Saved as version 2 and available to assistants.")).toBeVisible();
  await expect(page.getByText("2 versions")).toBeVisible();
  await expect(page.getByText(/Version 1 · Promotional discounts must not exceed 15%/)).toBeVisible();

  await page.goto("/chat?assistant=EMPLOYEE");
  await page.getByLabel("Ask a company question").fill("Can I give a customer 25% off now?");
  await page.getByRole("button", { name: "Ask the Playbook" }).click();
  await expect(page.getByTestId("employee-answer")).toContainText("10%");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chat?assistant=MARKETING");
  await expect(page.getByLabel("Message Marketing")).toBeVisible();
  await page.getByRole("button", { name: /^Context/ }).click();
  await expect(page.getByRole("complementary", { name: "Conversation knowledge" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(unexpectedExternalRequests).toEqual([]);
});

test("saves chat context as a department knowledge page", async ({ page }) => {
  await signInAsOwner(page);
  await page.request.post("/api/demo/reset");
  await page.goto("/chat?assistant=MARKETING");

  const composer = page.getByLabel("Message Marketing");
  await composer.fill("Front Desk should always confirm the customer's preferred contact method before sending an appointment reminder.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Recommendation: Tuesday Reset/i)).toBeVisible();

  await composer.fill("/save-knowledge");
  await page.getByRole("button", { name: "Send" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a trusted page" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Page title").fill("Confirm reminder contact preference");
  await dialog.getByLabel("Where it applies").selectOption("unit-front-desk");
  await dialog.getByRole("button", { name: "Save approved page" }).click();

  await expect(page.getByText(/Saved “Confirm reminder contact preference” to Knowledge/)).toBeVisible();
  await page.getByRole("link", { name: "Open page →" }).click();
  await expect(page.getByRole("heading", { name: "Confirm reminder contact preference" })).toBeVisible();
  await expect(page.getByText("Front Desk", { exact: true })).toBeVisible();
});
