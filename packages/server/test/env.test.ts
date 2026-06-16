import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFiles } from "../src/env.js";

const touched = new Set<string>();

afterEach(() => {
  for (const key of touched) delete process.env[key];
  touched.clear();
});

function track(key: string): string {
  touched.add(key);
  return key;
}

describe("environment loading", () => {
  it("loads dotenv files without overriding existing process env", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-env-"));
    const envFile = path.join(dir, ".env");
    fs.writeFileSync(
      envFile,
      [
        "SPECREG_TEST_ALPHA=from-file",
        "SPECREG_TEST_BETA=\"quoted value\"",
        "SPECREG_TEST_GAMMA=plain # trailing comment",
        "export SPECREG_TEST_EXISTING=from-file",
      ].join("\n")
    );

    process.env[track("SPECREG_TEST_EXISTING")] = "from-process";
    track("SPECREG_TEST_ALPHA");
    track("SPECREG_TEST_BETA");
    track("SPECREG_TEST_GAMMA");

    expect(loadEnvFiles([envFile])).toEqual([envFile]);
    expect(process.env.SPECREG_TEST_ALPHA).toBe("from-file");
    expect(process.env.SPECREG_TEST_BETA).toBe("quoted value");
    expect(process.env.SPECREG_TEST_GAMMA).toBe("plain");
    expect(process.env.SPECREG_TEST_EXISTING).toBe("from-process");
  });
});
