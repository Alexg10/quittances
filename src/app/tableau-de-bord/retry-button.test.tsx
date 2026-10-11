import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RetryButton } from "./retry-button";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("RetryButton", () => {
  it("R24 — est un bouton nommé « Réessayer », qui ne contient rien d'autre", () => {
    render(<RetryButton />);

    expect(screen.getByRole("button", { name: "Réessayer" })).toBeEnabled();
    expect(document.body).toHaveTextContent(/^Réessayer$/);
  });

  it("R24 — un clic appelle retry quand elle est fournie", async () => {
    const retry = vi.fn();
    render(<RetryButton retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
