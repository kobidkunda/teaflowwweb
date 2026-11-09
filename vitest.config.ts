import path from "node:path";
import os from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: {
    fileParallelism: false,
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 15000,
    env: {
      UPLOADS_DIR: path.join(os.tmpdir(), "teafloww-test-uploads"),
    },
  },
});
