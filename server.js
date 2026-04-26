/**
 * server.js — Hostinger entry point
 *
 * Wraps the Next.js standalone server with explicit 0.0.0.0 binding and
 * full error capture so the process never exits silently under Passenger.
 */

"use strict";

// Force production mode
process.env.NODE_ENV = "production";
process.env.NEXT_TELEMETRY_DISABLED = "1";

// Next.js standalone reads process.env.HOSTNAME to decide what address to
// bind to. Some hosts inject HOSTNAME as the machine name (e.g. srv1234)
// which is not a valid bind address → listen() throws and the process exits.
// Override it to 0.0.0.0 so we always bind to every interface.
process.env.HOSTNAME = "0.0.0.0";

// PORT env var is set by Hostinger/Passenger; default to 3000 for local dev.
const port = process.env.PORT || "3000";
console.log(`[server.js] starting — PORT=${port} HOSTNAME=0.0.0.0 NODE_ENV=production`);

// Catch anything the standalone server throws so Passenger sees an alive process.
process.on("uncaughtException", (err) => {
  console.error("[server.js] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[server.js] unhandledRejection:", reason);
});

require("./frontend/.next/standalone/server.js");
