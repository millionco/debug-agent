import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { discoverCdpUrl } from "../src/cdp-discovery";
import { CdpDiscoveryError } from "../src/errors";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("discoverCdpUrl", () => {
  it("returns webSocketDebuggerUrl from /json/version when present", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc" }),
    );

    const result = await discoverCdpUrl("127.0.0.1", 9222);
    expect(result).toBe("ws://127.0.0.1:9222/devtools/browser/abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:9222/json/version",
      expect.any(Object),
    );
  });

  it("rewrites the host/port on the returned ws URL", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ webSocketDebuggerUrl: "ws://other-host:1111/devtools/browser/abc" }),
    );

    const result = await discoverCdpUrl("127.0.0.1", 9222);
    expect(result).toBe("ws://127.0.0.1:9222/devtools/browser/abc");
  });

  it("falls back to /json/list when /json/version has no debugger URL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(
      jsonResponse([
        { type: "page", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/xyz" },
        { type: "browser", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc" },
      ]),
    );

    const result = await discoverCdpUrl("127.0.0.1", 9222);
    expect(result).toBe("ws://127.0.0.1:9222/devtools/browser/abc");
  });

  it("prefers the 'browser' target in /json/list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(
      jsonResponse([
        { type: "page", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/xyz" },
        { type: "browser", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc" },
      ]),
    );

    const result = await discoverCdpUrl("127.0.0.1", 9222);
    expect(result).toContain("/devtools/browser/abc");
  });

  it("falls back to first target if no 'browser' type exists", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(
        jsonResponse([
          { type: "page", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/xyz" },
        ]),
      );

    const result = await discoverCdpUrl("127.0.0.1", 9222);
    expect(result).toContain("/devtools/page/xyz");
  });

  it("throws CdpDiscoveryError when both endpoints fail", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));

    await expect(discoverCdpUrl("127.0.0.1", 9222)).rejects.toBeInstanceOf(CdpDiscoveryError);
  });

  it("throws CdpDiscoveryError when /json/list returns empty array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse([]));

    await expect(discoverCdpUrl("127.0.0.1", 9222)).rejects.toBeInstanceOf(CdpDiscoveryError);
  });
});
