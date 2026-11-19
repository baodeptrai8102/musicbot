import http from "node:http";
import { config } from "./config.js";

export function startServer(): http.Server {
  const server = http.createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];
    if (pathname === "/" || pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("OK");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    }
  });

  server.listen(config.PORT, "0.0.0.0", () => {
    console.log(`HTTP server listening on http://0.0.0.0:${config.PORT}`);
  });

  return server;
}
