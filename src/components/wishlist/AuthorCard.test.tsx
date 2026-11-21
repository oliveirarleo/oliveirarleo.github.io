import { fireEvent, render, screen } from "@solidjs/testing-library";
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
  it("shows wishes directly, without a per-author disclosure", () => {
    const { container } = renderCard([wish()]);

    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Alice" })).not.toBeNull();
    expect(
      screen.getByRole("link", {
        name: "A really good book (opens in a new tab)",
      }),
    ).not.toBeNull();
  });

  it("keeps every wish in the document", () => {
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

  it("reveals edit, remove, and reactions from each wish's options button", () => {
    const { container } = renderCard([wish()], "user-1");

    const toggle = screen.getByRole("button", {
      name: "Show options for A really good book",
    });
    const panel = container.querySelector("#wish-options-wish-1");

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.classList.contains("collapse-open")).toBe(false);

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("button", {
        name: "Hide options for A really good book",
      }),
    ).not.toBeNull();
    expect(panel?.classList.contains("collapse-open")).toBe(true);
    expect(screen.getByRole("button", { name: "Edit" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remove" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Love it: ❤️" })).not.toBeNull();
  });

  it("only offers edit and remove to the wish's owner", () => {
    const { unmount } = renderCard([wish()], "someone-else");

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Love it: ❤️" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    unmount();

    renderCard([wish()], "user-1");
    expect(screen.getByRole("button", { name: "Edit" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remove" })).not.toBeNull();
  });

  it("disables reactions when nobody is assumed", () => {
    renderCard([wish()]);

    expect(
      (screen.getByRole("button", { name: "Love it: ❤️" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
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
