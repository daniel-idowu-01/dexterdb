import { resolvePathWithinRoot } from "../src/utils/pathSecurity";
import { join } from "path";

describe("resolvePathWithinRoot", () => {
  const cwd = process.cwd();

  it("allows paths inside the project directory", () => {
    expect(() => resolvePathWithinRoot(join("src", "models"))).not.toThrow();
    expect(() => resolvePathWithinRoot(join(cwd, "src", "models"))).not.toThrow();
  });

  it("rejects traversal outside the project root", () => {
    expect(() => resolvePathWithinRoot(join(cwd, "..", "..", "etc", "passwd"))).toThrow(
      /outside project directory/
    );
  });
});
