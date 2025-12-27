#!/bin/bash

# Let's Encrypt initialization script with dry-run support
# Usage: ./init-letsencrypt.sh [--dry-run] [--staging]

set -e

# Load configuration from .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "Error: .env file not found. Copy .env.example to .env and configure it."
    exit 1
fi

# Read domains from .env (space-separated string -> array)
if [ -z "$LETSENCRYPT_DOMAINS" ]; then
    echo "Error: LETSENCRYPT_DOMAINS not set in .env"
    exit 1
fi
read -ra DOMAINS <<< "$LETSENCRYPT_DOMAINS"

# Read email from .env
if [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo "Error: LETSENCRYPT_EMAIL not set in .env"
    exit 1
fi
EMAIL="$LETSENCRYPT_EMAIL"

DATA_PATH="./certbot"
RSA_KEY_SIZE=4096

# Parse arguments
DRY_RUN=false
STAGING=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --staging)
            STAGING=true
            shift
            ;;
    esac
done

echo "### Let's Encrypt Certificate Setup ###"
echo "Domains: ${DOMAINS[*]}"
echo "Email: $EMAIL"
echo "Dry run: $DRY_RUN"
echo "Staging: $STAGING"
echo ""

# Create required directories
if [ ! -d "$DATA_PATH/conf" ]; then
    echo "### Creating certbot directories..."
    mkdir -p "$DATA_PATH/conf"
    mkdir -p "$DATA_PATH/www"
fi

# Download recommended TLS parameters if they don't exist
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
    echo "### Downloading recommended TLS parameters..."
    mkdir -p "$DATA_PATH/conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$DATA_PATH/conf/ssl-dhparams.pem"
    echo "TLS parameters downloaded."
fi

# Create dummy certificate for nginx to start (nginx needs certs to start with SSL config)
CERT_PATH="$DATA_PATH/conf/live/${DOMAINS[0]}"
if [ ! -d "$CERT_PATH" ]; then
    echo "### Creating dummy certificate for ${DOMAINS[0]}..."
    mkdir -p "$CERT_PATH"
    docker compose run --rm --entrypoint "\
        openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
            -keyout '/etc/letsencrypt/live/${DOMAINS[0]}/privkey.pem' \
            -out '/etc/letsencrypt/live/${DOMAINS[0]}/fullchain.pem' \
            -subj '/CN=localhost'" certbot
    echo "Dummy certificate created."
fi

echo "### Starting nginx..."
docker compose up --force-recreate -d frontend
echo "Nginx started."

echo "### Deleting dummy certificate..."
docker compose run --rm --entrypoint "\
    rm -Rf /etc/letsencrypt/live/${DOMAINS[0]} && \
    rm -Rf /etc/letsencrypt/archive/${DOMAINS[0]} && \
    rm -Rf /etc/letsencrypt/renewal/${DOMAINS[0]}.conf" certbot
echo "Dummy certificate deleted."

# Build domain arguments
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# Build certbot command
CERTBOT_CMD="certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL \
    $DOMAIN_ARGS \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --force-renewal"

# Add staging flag if requested (use Let's Encrypt staging server - higher rate limits for testing)
if [ "$STAGING" = true ]; then
    CERTBOT_CMD="$CERTBOT_CMD --staging"
    echo "### Using Let's Encrypt STAGING server (certificates won't be trusted)"
fi

# Add dry-run flag if requested
if [ "$DRY_RUN" = true ]; then
    CERTBOT_CMD="$CERTBOT_CMD --dry-run"
    echo "### Running in DRY-RUN mode (no certificates will be saved)"
fi

echo ""
echo "### Requesting Let's Encrypt certificate..."
echo "Command: $CERTBOT_CMD"
echo ""

docker compose run --rm --entrypoint "$CERTBOT_CMD" certbot

echo ""
if [ "$DRY_RUN" = true ]; then
    echo "### DRY RUN COMPLETE ###"
    echo "The certificate request would have succeeded."
    echo "Run without --dry-run to obtain real certificates."
else
    echo "### Reloading nginx..."
    docker compose exec frontend nginx -s reload
    echo "### DONE! Certificates installed successfully."
fi
