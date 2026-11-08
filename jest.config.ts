import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jest-fixed-jsdom",
  transform: {
    "^.+\\.(t|j)sx?$|^.+\\.mjs$": [
      "@swc/jest",
      { jsc: { transform: { react: { runtime: "automatic" } } } },
    ],
  },
  moduleNameMapper: {
    "^server-only$": "<rootDir>/src/test-utils/empty.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // msw v2 의존성 중 ESM 전용 패키지(.mjs, until-async)는 변환 대상에 포함
  transformIgnorePatterns: ["/node_modules/(?!(\\.pnpm/)?until-async[@/]).+\\.(c?js|json)$"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/components/ui/**", "!src/**/*.d.ts"],
};

export default config;
