import { describe, it, expect } from "vite-plus/test";
import { getErrorMessage } from "../utils/get-error-message.js";

describe("getErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("something broke"))).toBe("something broke");
  });

  it("extracts message from Error subclasses", () => {
    expect(getErrorMessage(new TypeError("wrong type"))).toBe("wrong type");
  });

  it("converts string values to string", () => {
    expect(getErrorMessage("raw string error")).toBe("raw string error");
  });

  it("converts number values to string", () => {
    expect(getErrorMessage(42)).toBe("42");
  });

  it("converts null to string", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("converts undefined to string", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("converts objects to string", () => {
    expect(getErrorMessage({ code: "ENOENT" })).toBe("[object Object]");
  });
});
