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
    updatedAt: null,
    reactions: [],
    ...overrides,
  };
}

function renderCard(
  wishes: Wish[],
  activeUserId: string | undefined = undefined,
) {
  return render(() => (
    <AuthorCard
      group={{ author: "Alice", userId: "user-1", wishes }}
      activeUserId={activeUserId}
      removingId={null}
      onRemove={() => {}}
      onEdit={() => {}}
      onReact={() => {}}
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

  it("shows owner controls and the reaction palette only when signed in", () => {
    const { unmount } = renderCard([wish()]);

    expect(
      screen.queryByRole("button", { name: "Edit A really good book" }),
    ).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Love it: ❤️" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    unmount();

    renderCard([wish()], "user-1");
    expect(
      screen.getByRole("button", { name: "Edit A really good book" }),
    ).not.toBeNull();
    expect(
      (screen.getByRole("button", { name: "Love it: ❤️" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("summarises reactions and marks the active user's own", () => {
    renderCard(
      [
        wish({
          reactions: [{ emoji: "❤️", userIds: ["user-1", "user-2"] }],
        }),
      ],
      "user-1",
    );

    const reaction = screen.getByRole("button", { name: "Love it: ❤️, 2" });
    expect(reaction.getAttribute("aria-pressed")).toBe("true");
    expect(reaction.textContent).toContain("2");
  });
});
