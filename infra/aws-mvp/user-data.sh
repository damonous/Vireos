#!/bin/bash
# =============================================================================
# Vireos MVP — EC2 Bootstrap Script (user-data)
# =============================================================================
# Runs once on first boot. Installs Docker, Docker Compose, Caddy, and Git.
# The deploy.sh script handles pushing code and starting the stack.
# =============================================================================
set -euxo pipefail

# Log all output for debugging
exec > >(tee /var/log/user-data.log) 2>&1

# -----------------------------------------------------------------------------
# System updates
# -----------------------------------------------------------------------------
dnf update -y

# -----------------------------------------------------------------------------
# Install Docker
# -----------------------------------------------------------------------------
dnf install -y docker git rsync
systemctl enable docker
systemctl start docker

# Add ec2-user to docker group so deploy.sh can run without sudo
usermod -aG docker ec2-user

# -----------------------------------------------------------------------------
# Install Docker Compose plugin
# -----------------------------------------------------------------------------
DOCKER_COMPOSE_VERSION="v2.32.4"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Also make it available as standalone command
ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose

# -----------------------------------------------------------------------------
# Install Caddy (direct binary — COPR doesn't support Amazon Linux 2023)
# -----------------------------------------------------------------------------
curl -sL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /usr/local/bin/caddy
chmod +x /usr/local/bin/caddy

groupadd --system caddy 2>/dev/null || true
useradd --system --gid caddy --create-home --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy 2>/dev/null || true
mkdir -p /etc/caddy /var/log/caddy
chown caddy:caddy /var/log/caddy

cat > /etc/systemd/system/caddy.service <<'CADDYUNIT'
[Unit]
Description=Caddy
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
CADDYUNIT

systemctl daemon-reload
systemctl enable caddy

# -----------------------------------------------------------------------------
# Create app directory
# -----------------------------------------------------------------------------
mkdir -p /opt/vireos
chown ec2-user:ec2-user /opt/vireos

echo "=== User-data bootstrap complete ==="
