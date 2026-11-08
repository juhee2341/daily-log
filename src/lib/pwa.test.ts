import { isIos, urlBase64ToUint8Array } from "./pwa";

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url without padding", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });
});

describe("isIos", () => {
  it("detects iPhone and iPad user agents", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
});
