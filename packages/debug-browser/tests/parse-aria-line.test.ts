import { describe, expect, it } from "vite-plus/test";
import { parseAriaLine } from "../src/utils/parse-aria-line";

describe("parseAriaLine", () => {
  it("should parse a role with a quoted name", () => {
    expect(parseAriaLine('- button "Submit"')).toEqual({ role: "button", name: "Submit" });
  });

  it("should parse a role without a name", () => {
    expect(parseAriaLine("- paragraph:")).toEqual({ role: "paragraph", name: "" });
  });

  it("should parse indented lines", () => {
    expect(parseAriaLine('    - link "Click me"')).toEqual({ role: "link", name: "Click me" });
  });

  it("should return undefined for text role", () => {
    expect(parseAriaLine("- text: hello world")).toBeUndefined();
  });

  it("should return undefined for non-matching lines", () => {
    expect(parseAriaLine("just some text")).toBeUndefined();
    expect(parseAriaLine("")).toBeUndefined();
    expect(parseAriaLine("  /url: https://example.com")).toBeUndefined();
  });

  it("should handle names with special characters", () => {
    expect(parseAriaLine('- heading "Hello & Goodbye"')).toEqual({
      role: "heading",
      name: "Hello & Goodbye",
    });
  });

  it("should handle empty quoted name", () => {
    expect(parseAriaLine('- button ""')).toEqual({ role: "button", name: "" });
  });

  it("should handle escaped quotes in name", () => {
    expect(parseAriaLine('- button "Say \\"hello\\""')).toEqual({
      role: "button",
      name: 'Say "hello"',
    });
  });

  it("should handle escaped backslash in name", () => {
    expect(parseAriaLine('- button "path\\\\to\\\\file"')).toEqual({
      role: "button",
      name: "path\\to\\file",
    });
  });

  it("should handle name with mixed escapes", () => {
    expect(parseAriaLine('- link "Click \\"here\\" for C:\\\\docs"')).toEqual({
      role: "link",
      name: 'Click "here" for C:\\docs',
    });
  });
});
