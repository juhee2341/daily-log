// Realtime 채널로 오가는 "변경 신호". 내용(포스트·닉네임 등)은 절대 싣지 않는다 — 클라이언트는 신호를 받으면 다시 읽는다.

export const SIGNAL_EVENT = "signal";

export type SessionSignal =
  | { type: "post.created" }
  | { type: "post.deleted" }
  | { type: "comment.created"; postId: string }
  | { type: "comment.deleted"; postId: string }
  | { type: "member.pending" }
  | { type: "member.joined" }
  | { type: "member.left"; memberId: string }
  | { type: "member.kicked"; memberId: string }
  | { type: "invite.changed" }
  | { type: "mission.updated" }
  | { type: "session.destroyed" };

export type JoinSignal = { type: "member.approved" } | { type: "member.rejected" };

export const sessionTopic = (sessionId: string) => `session:${sessionId}`;
export const joinTopic = (memberId: string) => `join:${memberId}`;
