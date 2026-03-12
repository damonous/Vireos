#!/usr/bin/env bash
# =============================================================================
# Vireos MVP — Deployment Script
# =============================================================================
# Pushes the project to the EC2 instance and starts the Docker Compose stack.
#
# Prerequisites:
#   1. Run `terraform apply` first to create the instance
#   2. Create a .env file in this directory (copy from backend/.env.example)
#   3. Update the .env with:
#      - Real API keys and secrets
#      - The Elastic IP in CORS_ORIGINS, API_BASE_URL, SSL_CERT_ALT_NAMES
#      - NODE_ENV=production
#
# Usage:
#   ./deploy.sh              # Full deploy (sync code + build + start)
#   ./deploy.sh restart      # Just restart containers (no rebuild)
#   ./deploy.sh logs         # Tail container logs
#   ./deploy.sh status       # Show container status
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Read Terraform outputs
cd "$SCRIPT_DIR"
if ! command -v terraform &> /dev/null; then
  echo "ERROR: terraform not found. Install it first."
  exit 1
fi

IP=$(terraform output -raw public_ip 2>/dev/null || true)
KEY_PATH=$(terraform output -raw ssh_private_key_path 2>/dev/null || true)

if [ -z "$IP" ] || [ -z "$KEY_PATH" ]; then
  echo "ERROR: Could not read Terraform outputs. Run 'terraform apply' first."
  exit 1
fi

SSH_OPTS="-i $KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10"
SSH_CMD="ssh $SSH_OPTS ec2-user@$IP"
SCP_CMD="scp $SSH_OPTS"

# Check that .env exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "ERROR: No .env file found at $SCRIPT_DIR/.env"
  echo "Copy backend/.env.example to $SCRIPT_DIR/.env and update it for production."
  exit 1
fi

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
wait_for_ssh() {
  echo "Waiting for SSH to become available on $IP..."
  for i in $(seq 1 30); do
    if $SSH_CMD "echo ok" &>/dev/null; then
      echo "SSH is ready."
      return 0
    fi
    echo "  Attempt $i/30 — retrying..."
    sleep 10
  done
  echo "ERROR: SSH not available after 5 minutes. Check the instance status in AWS console."
  exit 1
}

run_remote() {
  $SSH_CMD "$@"
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
cmd_deploy() {
  wait_for_ssh

  echo ""
  echo "=== Syncing project files to $IP ==="
  # Use rsync if available, fall back to scp
  if command -v rsync &> /dev/null; then
    rsync -avz --delete \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude '.terraform' \
      --exclude '*.tfstate*' \
      --exclude 'infra' \
      --exclude '.env' \
      --exclude '*.pem' \
      -e "ssh $SSH_OPTS" \
      "$PROJECT_ROOT/" "ec2-user@$IP:/opt/vireos/"
  else
    # Fallback: tar + scp
    echo "rsync not found, using tar+scp fallback..."
    cd "$PROJECT_ROOT"
    tar czf /tmp/vireos-deploy.tar.gz \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='.terraform' \
      --exclude='*.tfstate*' \
      --exclude='infra' \
      --exclude='.env' \
      --exclude='*.pem' \
      .
    $SCP_CMD /tmp/vireos-deploy.tar.gz "ec2-user@$IP:/tmp/"
    run_remote "rm -rf /opt/vireos/* && tar xzf /tmp/vireos-deploy.tar.gz -C /opt/vireos && rm /tmp/vireos-deploy.tar.gz"
    rm /tmp/vireos-deploy.tar.gz
  fi

  echo ""
  echo "=== Copying .env file ==="
  $SCP_CMD "$SCRIPT_DIR/.env" "ec2-user@$IP:/opt/vireos/backend/.env"

  echo ""
  echo "=== Copying Caddyfile ==="
  $SCP_CMD "$SCRIPT_DIR/Caddyfile" "ec2-user@$IP:/tmp/Caddyfile"
  run_remote "sudo cp /tmp/Caddyfile /etc/caddy/Caddyfile"

  echo ""
  echo "=== Building and starting Docker Compose stack ==="
  run_remote "cd /opt/vireos/backend && docker compose -f docker-compose.yml up -d --build"

  echo ""
  echo "=== Starting Caddy reverse proxy ==="
  run_remote "sudo systemctl restart caddy"

  echo ""
  echo "=== Waiting for application to become healthy ==="
  for i in $(seq 1 20); do
    if run_remote "curl -ksfm5 https://localhost/health" &>/dev/null; then
      echo ""
      echo "=== Deployment successful! ==="
      echo "  App URL:  https://$IP"
      echo "  SSH:      ssh -i $KEY_PATH ec2-user@$IP"
      echo ""
      echo "  Note: Your browser will show a certificate warning — this is expected"
      echo "  with the self-signed cert. Accept it to proceed."
      return 0
    fi
    echo "  Health check attempt $i/20..."
    sleep 15
  done

  echo ""
  echo "WARNING: Health check did not pass. The app may still be starting."
  echo "  Check logs with: ./deploy.sh logs"
  echo "  Check status with: ./deploy.sh status"
}

cmd_restart() {
  echo "=== Restarting containers ==="
  run_remote "cd /opt/vireos/backend && docker compose -f docker-compose.yml restart"
  run_remote "sudo systemctl restart caddy"
  echo "Done."
}

cmd_logs() {
  run_remote "cd /opt/vireos/backend && docker compose -f docker-compose.yml logs --tail=100 -f"
}

cmd_status() {
  echo "=== Container status ==="
  run_remote "cd /opt/vireos/backend && docker compose -f docker-compose.yml ps"
  echo ""
  echo "=== Caddy status ==="
  run_remote "sudo systemctl status caddy --no-pager" || true
  echo ""
  echo "=== Health check ==="
  run_remote "curl -ksf https://localhost/health" && echo " — OK" || echo " — FAILED"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
case "${1:-deploy}" in
  deploy)  cmd_deploy ;;
  restart) cmd_restart ;;
  logs)    cmd_logs ;;
  status)  cmd_status ;;
  *)
    echo "Usage: $0 [deploy|restart|logs|status]"
    exit 1
    ;;
esac
