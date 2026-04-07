import { describe, it, expect, afterEach } from "vite-plus/test";
import http from "node:http";
import { pingServer } from "../src/utils/ping-server.js";

describe("pingServer", () => {
  let serverInstance: http.Server | undefined;

  afterEach(async () => {
    if (serverInstance) {
      await new Promise<void>((resolve) => serverInstance!.close(() => resolve()));
      serverInstance = undefined;
    }
  });

  it("returns true when server is running", async () => {
    serverInstance = http.createServer((_request, response) => {
      response.writeHead(200).end();
    });

    const port = await new Promise<number>((resolve) => {
      serverInstance!.listen(0, "127.0.0.1", () => {
        const address = serverInstance!.address();
        resolve((address as { port: number }).port);
      });
    });

    const isAlive = await pingServer("127.0.0.1", port);
    expect(isAlive).toBe(true);
  });

  it("returns false when no server is running on the port", async () => {
    const isAlive = await pingServer("127.0.0.1", 19876);
    expect(isAlive).toBe(false);
  });

  it("returns false for unreachable host", async () => {
    const isAlive = await pingServer("192.0.2.1", 1);
    expect(isAlive).toBe(false);
  });
});
