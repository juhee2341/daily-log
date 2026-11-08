// supabase-js 쿼리 빌더를 흉내 내는 테스트용 가짜.
// 각 쿼리가 끝날 때(await) handler가 { table, op, filters, payload }를 받아 결과를 돌려준다.

export type FakeCall = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  filters: Record<string, unknown>;
  payload?: unknown;
};
export type FakeResult = { data?: unknown; error?: unknown; count?: number | null };

export type FakeStorage = Record<string, (...args: never[]) => unknown>;

export function fakeSupabase(handler: (call: FakeCall) => FakeResult | undefined, storage: FakeStorage = {}) {
  const calls: FakeCall[] = [];

  const from = (table: string) => {
    const call: FakeCall = { table, op: "select", filters: {} };
    const builder: Record<string, unknown> = {};
    const chain = (fn?: (...args: unknown[]) => void) => (...args: unknown[]) => {
      fn?.(...args);
      return builder;
    };
    builder.select = chain();
    builder.insert = chain((payload) => Object.assign(call, { op: "insert", payload }));
    builder.update = chain((payload) => Object.assign(call, { op: "update", payload }));
    builder.delete = chain(() => (call.op = "delete"));
    for (const name of ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"]) {
      builder[name] = chain((col, value) => (call.filters[`${name}:${String(col)}`] = value));
    }
    for (const name of ["order", "limit", "single", "maybeSingle"]) builder[name] = chain();
    builder.then = (resolve: (r: FakeResult) => unknown, reject: (e: unknown) => unknown) => {
      calls.push(call);
      try {
        return Promise.resolve(resolve({ data: null, error: null, ...handler(call) }));
      } catch (e) {
        return reject(e);
      }
    };
    return builder;
  };

  return { client: { from, storage: { from: () => storage } }, calls };
}
