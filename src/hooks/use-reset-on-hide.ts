"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Cache Components는 떠난 화면을 <Activity>로 숨겨 state를 그대로 보존한다.
 * 다시 돌아왔을 때 보이면 안 되는 일회성 결과(방금 만든 링크, 지난 에러 등)를 가리기 위한 플래그.
 * `stale`이 true면 지난 방문의 결과이므로 숨기고, 새로 제출할 때 `markFresh()`를 부른다.
 */
export function useResetOnHide() {
  const [stale, setStale] = useState(false);
  // 숨겨질 때 동기적으로 실행돼서, 다시 보일 때 지난 결과가 한 프레임도 비치지 않는다
  useLayoutEffect(() => () => setStale(true), []);
  return { stale, markFresh: () => setStale(false) };
}
