# HTTPS tĩnh cho trang đo — mic trên điện thoại chỉ mở được ở secure context.
# Chứng chỉ tự ký: điện thoại sẽ hỏi "Tiếp tục dù không an toàn" một lần.
import http.server, ssl, sys, os
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".js": "text/javascript"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.client_address[0], fmt % args))
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), H)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain("cert.pem", "key.pem")
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print(f"https://0.0.0.0:{port}", flush=True); httpd.serve_forever()
