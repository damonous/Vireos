#!/bin/sh
set -eu

if [ "${ENABLE_HTTPS:-false}" = "true" ]; then
  cert_path="${SSL_CERT_PATH:-/app/backend/certs/dev-cert.pem}"
  key_path="${SSL_KEY_PATH:-/app/backend/certs/dev-key.pem}"
  cert_dir="$(dirname "$cert_path")"

  mkdir -p "$cert_dir"

  if [ ! -f "$cert_path" ] || [ ! -f "$key_path" ] || [ "${FORCE_SSL_CERT_REGEN:-false}" = "true" ]; then
    cn="${SSL_CERT_CN:-localhost}"
    san_list="${SSL_CERT_ALT_NAMES:-DNS:localhost,IP:127.0.0.1}"
    config_file="$(mktemp)"

    cat > "$config_file" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${cn}

[v3_req]
subjectAltName = ${san_list}
EOF

    openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
      -keyout "$key_path" \
      -out "$cert_path" \
      -config "$config_file" \
      -extensions v3_req

    rm -f "$config_file"
  fi
fi

exec "$@"
