#!/usr/bin/env python3
"""Serve the app on http://127.0.0.1:8777 for local use. Every response says "Cache-Control: no-cache", so the
browser checks each file with the server (a 304 when it has not changed) and never runs an old copy after an
update.

Usage (from the repo root): python3 app/serve.py [port]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


class Server(ThreadingHTTPServer):
    # the browser fetches modules and data in parallel; the default backlog of 5 drops some of those connections
    request_queue_size = 128


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    handler = partial(NoCache, directory=str(Path(__file__).resolve().parent))
    with Server(("127.0.0.1", port), handler) as httpd:
        print(f"serving {Path(__file__).resolve().parent} on http://127.0.0.1:{port}/")
        httpd.serve_forever()
