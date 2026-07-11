import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the product promise and routes every public action to the waitlist", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Explain it once. Your company remembers." })).toBeInTheDocument();
    expect(screen.getByText(/turn everyday owner conversations into approved company knowledge/i)).toBeInTheDocument();
    expect(screen.getByText(/private beta.*invite early teams gradually/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Join the waitlist/i })).toHaveLength(3);
    expect(screen.queryByText(/salon/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open demo controls/i })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /Join the waitlist/i })) {
      expect(link).toHaveAttribute("href", "/waitlist");
    }
  });
});
