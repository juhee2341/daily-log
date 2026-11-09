import { fireEvent, render, screen } from "@testing-library/react";
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
