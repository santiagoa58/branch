import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("shows a clearly labeled destructive action but never confirms on cancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    render(
      <ConfirmDialog
        open
        title="Delete saved flow?"
        description='Delete "Checkout"? This cannot be undone.'
        confirmLabel="Delete flow"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete saved flow?" });
    expect(dialog).toHaveTextContent("Checkout");
    expect(within(dialog).getByRole("button", { name: "Delete flow" })).toHaveClass(
      "text-destructive",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms only when the explicit destructive button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    render(
      <ConfirmDialog
        open
        title="Delete saved flow?"
        description="The saved flow will be removed."
        confirmLabel="Delete flow"
        onOpenChange={vi.fn<(open: boolean) => void>()}
        onConfirm={onConfirm}
      />,
    );
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete flow" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as cancellation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => void>();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    render(
      <ConfirmDialog
        open
        title="Delete saved flow?"
        description="The saved flow will be removed."
        confirmLabel="Delete flow"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
