import http from "node:http";
import { LOCK_PING_TIMEOUT_MS } from "../constants.js";

export const pingServer = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const request = http.get(
      { hostname: host, port, path: "/", timeout: LOCK_PING_TIMEOUT_MS },
      (response) => {
        response.resume();
        resolve(response.statusCode !== undefined);
      },
    );
    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
