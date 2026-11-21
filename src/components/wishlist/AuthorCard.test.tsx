import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import type { Wish } from "../../lib/wishlist-api";
import AuthorCard from "./AuthorCard";

function wish(overrides: Partial<Wish> = {}): Wish {
  return {
    id: "wish-1",
    userId: "user-1",
    author: "Alice",
    name: "A really good book",
    link: "https://example.com/book",
    createdAt: "2026-11-21T10:00:00.000Z",
    ...overrides,
  };
}

function renderCard(wishes: Wish[]) {
  return render(() => (
    <AuthorCard
      group={{ author: "Alice", userId: "user-1", wishes }}
      activeUserId={undefined}
      removingId={null}
      onRemove={() => {}}
    />
  ));
}

describe("AuthorCard", () => {
  it("starts collapsed behind a checkbox disclosure", () => {
    const { container } = renderCard([wish()]);

    const collapse = container.querySelector(".collapse");
    expect(collapse).not.toBeNull();

    const toggle = collapse?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(false);
  });

  it("names the disclosure toggle after the author and their wish count", () => {
    renderCard([wish(), wish({ id: "wish-2", name: "Warm socks" })]);

    expect(
      screen.getByRole("checkbox", { name: "Alice: 2 wishes" }),
    ).not.toBeNull();
  });

  it("keeps every wish in the document while the card is collapsed", () => {
    renderCard([wish(), wish({ id: "wish-2", name: "Warm socks" })]);

    expect(
      screen.getByRole("link", {
        name: "A really good book (opens in a new tab)",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Warm socks (opens in a new tab)" }),
    ).not.toBeNull();
  });
});
