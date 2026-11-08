import { render, screen } from "@testing-library/react";
import { InAppBrowserGate } from "./InAppBrowserGate";

const KAKAO_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.6.5";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

afterEach(() => {
  sessionStorage.clear();
  jest.restoreAllMocks();
});

describe("InAppBrowserGate", () => {
  it("renders the escape prompt inside KakaoTalk without crashing", () => {
    setUserAgent(KAKAO_IOS);
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<InAppBrowserGate />);
    expect(screen.getByRole("dialog", { name: "기본 브라우저로 열어주세요" })).toBeInTheDocument();
    expect(errors).not.toHaveBeenCalled();
  });

  it("renders nothing in a regular browser", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Version/17.4 Mobile/15E148 Safari/604.1");
    const { container } = render(<InAppBrowserGate />);
    expect(container).toBeEmptyDOMElement();
  });
});
