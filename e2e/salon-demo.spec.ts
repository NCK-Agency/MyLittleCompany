import { expect, test } from "@playwright/test";

test("completes the governed salon memory loop", async ({ page }) => {
  await page.request.post("/api/demo/reset");
  await page.goto("/chat?assistant=MARKETING");

  const composer = page.getByLabel("Message Marketing");
  await composer.fill("Tuesdays are quiet. Create a promotion to bring more customers in.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Tuesday Reset/)).toBeVisible();

  await composer.fill("We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.");
  await page.getByRole("button", { name: "Send" }).click();
  const candidate = page.getByTestId("candidate-card");
  await expect(candidate).toContainText("Promotional discounts must not exceed 15%");
  const beforeApproval = await page.request.get("/api/memories");
  expect(JSON.stringify(await beforeApproval.json())).not.toContain("Promotional discounts must not exceed 15%");

  await candidate.getByRole("button", { name: "Approve" }).click();
  await expect(candidate).toContainText("Approved and ready in the Playbook.");

  await composer.fill("Please revise the Tuesday promotion using our approved company rules.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/complimentary conditioning ritual/).last()).toBeVisible();
  await expect(page.getByText(/Source · Promotional discounts must not exceed 15%/)).toBeVisible();

  await page.getByRole("button", { name: /Operations/ }).click();
  await page.getByRole("button", { name: "Generate Tuesday Promotion SOP" }).click();
  await expect(page.getByTestId("sop-draft")).toContainText("Tuesday Signature Refresh SOP");
  await page.getByRole("button", { name: "Save for review" }).click();
  await expect(page.getByText("Saved for review. It is not approved yet.")).toBeVisible();

  await page.getByRole("button", { name: /Employee/ }).click();
  await page.getByLabel("Ask a company question").fill("Can I give a customer 25% off?");
  await page.getByRole("button", { name: "Ask the Playbook" }).click();
  const answer = page.getByTestId("employee-answer");
  await expect(answer).toContainText("No. The current approved promotion policy caps discounts at 15%.");
  await expect(answer).toContainText("Source · Promotional discounts must not exceed 15%");

  await page.getByRole("link", { name: "Playbook" }).click();
  await expect(page.getByRole("heading", { name: "Approved company knowledge" })).toBeVisible();
  await expect(page.getByText("Promotional discounts must not exceed 15%", { exact: true })).toBeVisible();
});
