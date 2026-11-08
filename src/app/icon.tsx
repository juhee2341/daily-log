import { ImageResponse } from "next/og";

// 카메라 셔터 모양: 검은 바탕 + 흰 고리 + 빨간 점 (홈 화면·알림 아이콘)
export function generateImageMetadata() {
  return [
    { id: "192", contentType: "image/png", size: { width: 192, height: 192 } },
    { id: "512", contentType: "image/png", size: { width: 512, height: 512 } },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(<ShutterMark size={size} />, { width: size, height: size });
}

export function ShutterMark({ size }: { size: number }) {
  const ring = size * 0.56;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "black" }}>
      <div
        style={{
          width: ring,
          height: ring,
          borderRadius: "50%",
          border: `${Math.round(size * 0.06)}px solid white`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: ring * 0.42, height: ring * 0.42, borderRadius: "50%", background: "rgb(239, 68, 68)" }} />
      </div>
    </div>
  );
}
