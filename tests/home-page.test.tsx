import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the product promise and governed-memory statement", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Explain it once. Your company remembers." })).toBeInTheDocument();
    expect(screen.getByText(/turns everyday owner conversations into human-approved company knowledge/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See the salon remember/i })).toHaveAttribute("href", "/chat?assistant=MARKETING");
  });
});
