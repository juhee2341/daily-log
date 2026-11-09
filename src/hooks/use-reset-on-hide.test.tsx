import { act, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { useResetOnHide } from "./use-reset-on-hide";

function Probe() {
  const { stale, markFresh } = useResetOnHide();
  return (
    <button type="button" onClick={markFresh}>
      {stale ? "stale" : "fresh"}
    </button>
  );
}

describe("useResetOnHide", () => {
  it("marks results stale after the screen was hidden by <Activity>, until the next submit", () => {
    const { rerender } = render(
      <Activity mode="visible">
        <Probe />
      </Activity>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("fresh");

    rerender(
      <Activity mode="hidden">
        <Probe />
      </Activity>,
    );
    rerender(
      <Activity mode="visible">
        <Probe />
      </Activity>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("stale");

    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button")).toHaveTextContent("fresh");
  });
});
