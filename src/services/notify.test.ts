import { expect, it, vi } from "vite-plus/test";
import { sileo } from "sileo";
import { notify } from "./notify";

vi.mock("sileo", () => ({
  sileo: {
    success: vi.fn<() => string>(() => "toast"),
    error: vi.fn<() => string>(() => "toast"),
    warning: vi.fn<() => string>(() => "toast"),
    info: vi.fn<() => string>(() => "toast"),
  },
}));

it("passes a toast button through to sileo", () => {
  const onClick = vi.fn<() => void>();
  notify.success({
    title: "Design updated",
    message: "+1 added",
    button: { title: "Undo", onClick },
  });
  expect(sileo.success).toHaveBeenCalledWith({
    title: "Design updated",
    description: "+1 added",
    button: { title: "Undo", onClick },
  });
});

it("omits the button when none is given", () => {
  notify.info({ title: "Saved" });
  expect(sileo.info).toHaveBeenCalledWith({ title: "Saved" });
});
