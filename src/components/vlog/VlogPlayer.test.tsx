import { fireEvent, render, screen } from "@testing-library/react";
import { VlogPlayer } from "./VlogPlayer";
import type { VlogItem } from "@/lib/vlog";

const photo = (id: string): VlogItem => ({
  id,
  type: "photo",
  url: `https://x.test/${id}.jpg`,
  durationMs: 2000,
  memberId: "m1",
  nickname: "민지",
  caption: null,
  slotStart: "2026-11-09T03:00:00Z",
});

describe("VlogPlayer loading", () => {
  it("shows a loader while the current photo is still downloading, then hides it", () => {
    render(<VlogPlayer items={[photo("p1"), photo("p2")]} />);
    fireEvent.click(screen.getByRole("button", { name: /탭해서 재생/ }));
    expect(screen.getByText("다음 장면을 불러오는 중")).toBeInTheDocument();
    fireEvent.load(screen.getByAltText("민지의 사진"));
    expect(screen.queryByText("다음 장면을 불러오는 중")).not.toBeInTheDocument();
  });
});
