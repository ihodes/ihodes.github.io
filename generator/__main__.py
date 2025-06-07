import argparse
import os
import http.server
import socketserver
from watchdog.observers import Observer
from watchdog.events import LoggingEventHandler

import generate as g

PORT = 8000
DIRECTORY = "dist"
OBSERVED_DIRS = ["templates", "posts", "notes", "images", "css"]

socketserver.TCPServer.allow_reuse_address = True
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)



parser = argparse.ArgumentParser(prog='notes', description='generate blog')
parser.add_argument('url', nargs='?', default='https://isaachodes.io')
parser.add_argument('-s', '--serve', action='store_true')
parser.add_argument('-c', '--clean', action='store_true')
parser.add_argument('-p', '--port')


if __name__ == '__main__':
    args = parser.parse_args()

    # Use localhost URL when serving locally
    if args.serve:
        port = int(args.port) if args.port else PORT
        base_url = f'http://localhost:{port}'
    else:
        base_url = args.url

    if args.clean:
        g.clean_dest()
    else:
        g.write_website(base_url)

    if args.serve:
        class Event(LoggingEventHandler):
            def dispatch(self, event):
                g.write_website(base_url)

        event_handler = Event()
        observers = []
        for d in OBSERVED_DIRS:
            observer = Observer()
            observer.schedule(event_handler, d, recursive=True)
            observer.start()
            observers.append(observer)

        port = int(args.port) if args.port else PORT
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print("serving at port", port)
            httpd.serve_forever()
