import packageJson from "debug-agent/package.json";
import { getCorsHeaders, createOptionsResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const corsOptions = { methods: "*" as const, headers: "*" as const };

export const GET = (): Response =>
  new Response(packageJson.version, {
    headers: {
      ...getCorsHeaders(corsOptions),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

export const OPTIONS = (): Response => createOptionsResponse(corsOptions);
