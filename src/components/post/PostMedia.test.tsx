import { act, fireEvent, render, screen } from "@testing-library/react";
import { PostMedia } from "./PostMedia";

describe("PostMedia", () => {
  it("shows a loader until the photo has loaded", () => {
    render(<PostMedia type="photo" url="https://x.test/a.jpg" label="민지의 사진" />);
    expect(screen.getByRole("status")).toHaveTextContent("불러오는 중");
    fireEvent.load(screen.getByAltText("민지의 사진"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stops showing the loader when the media fails, so the screen is not stuck", () => {
    render(<PostMedia type="photo" url="https://x.test/a.jpg" label="민지의 사진" />);
    fireEvent.error(screen.getByAltText("민지의 사진"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("PostMedia fallback", () => {
  it("reveals a video that never reports loading (e.g. iOS low power mode) so it can be played by hand", () => {
    jest.useFakeTimers();
    render(<PostMedia type="video" url="https://x.test/a.mp4" label="민지의 영상" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(4000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
