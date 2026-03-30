#!/bin/bash
# ORACLE AWS Deployment Script
# Run this on your EC2 instance (3.138.91.167)
#
# Prerequisites:
#   - Docker & Docker Compose installed
#   - Domain pointing to this server (for TLS)
#   - Git access to the repo
#
# Usage:
#   git clone https://github.com/mharburg8/friend_assistant.git
#   cd friend_assistant/oracle
#   cp deploy/.env.production.example .env.production
#   # Edit .env.production with your values
#   bash deploy/deploy.sh

set -e

DOMAIN="oracle.harburgautomation.com"
EMAIL="${CERTBOT_EMAIL:-HarburgMark@gmail.com}"

echo "=== ORACLE Deployment ==="
echo "Domain: $DOMAIN"
echo ""

# Step 1: Get TLS certificate if not exists
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo ">> Getting TLS certificate from Let's Encrypt..."
    sudo apt-get update && sudo apt-get install -y certbot
    sudo certbot certonly --standalone -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
    echo ">> Certificate obtained."
else
    echo ">> TLS certificate already exists."
fi

# Step 2: Update nginx config with actual domain
echo ">> Configuring nginx..."
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" deploy/nginx.conf

# Step 3: Build and start
echo ">> Building and starting services..."
docker compose up -d --build

echo ""
echo "=== Deployment Complete ==="
echo "App: https://$DOMAIN"
echo "Signal API: http://localhost:8080 (internal only)"
echo "PostgreSQL: localhost:5432 (internal only)"
echo ""
echo "Next steps:"
echo "  1. Register Signal number: curl -X POST http://localhost:8080/v1/register/YOUR_PHONE_NUMBER"
echo "  2. Verify Signal: curl -X POST http://localhost:8080/v1/register/YOUR_PHONE_NUMBER/verify/CODE"
echo "  3. Set up Signal webhook in .env.production"
echo ""
echo "To view logs: docker compose logs -f oracle"
