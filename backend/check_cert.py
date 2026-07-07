import socket
import ssl
import struct

host, port = "aws-1-ap-southeast-1.pooler.supabase.com", 5432

sock = socket.create_connection((host, port))

# Postgres SSLRequest packet: length(4) + code(4)
ssl_request = struct.pack("!II", 8, 80877103)
sock.sendall(ssl_request)

response = sock.recv(1)
if response != b"S":
    print(f"Server refused SSL negotiation, got: {response!r}")
    sock.close()
    raise SystemExit(1)

ctx = ssl._create_unverified_context()
with ctx.wrap_socket(sock, server_hostname=host) as ssock:
    cert = ssock.getpeercert(binary_form=True)
    print(ssl.DER_cert_to_PEM_cert(cert))