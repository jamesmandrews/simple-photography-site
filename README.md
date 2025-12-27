# Photo Gallery

A self-hosted photo gallery application with a Lightroom Classic plugin for seamless publishing.

## Overview

This project consists of three main components:

- **photo-api** - Express.js REST API with TypeORM and MariaDB for photo management
- **photo-gallery** - Angular frontend for displaying photos in a responsive gallery
- **PhotoGalleryPublish.lrplugin** - Adobe Lightroom Classic plugin for direct publishing

## Features

- Responsive masonry-style photo gallery
- Multiple image sizes (thumbnail, featured, display) auto-generated from uploads
- Collection/album organization
- Photo metadata extraction and display (EXIF, camera info, location)
- Direct publishing from Lightroom Classic
- Docker Compose deployment

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

### Running with Docker

1. Clone the repository:
   ```bash
   git clone git@github.com:jamesmandrews/simple-photography-site.git
   cd photo-website-two
   ```

2. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your secure passwords
   ```

3. Start the services:
   ```bash
   docker-compose up -d --build
   ```

4. Generate and set the API key:
   ```bash
   # Generate a secure random key
   openssl rand -base64 32

   # Set it in the API (replace with your generated key)
   docker-compose exec api node dist/scripts/set-api-key.js YOUR_GENERATED_KEY
   ```
   Save this key - you'll need it for the Lightroom plugin.

5. Access the application:
   - Frontend: http://localhost:8081
   - API: http://localhost:3000 (internal)

### Production Deployment with SSL

For production with Let's Encrypt SSL certificates.

#### Prerequisites

**1. DNS Configuration**

Configure DNS records pointing to your server's public IP address:

| Type | Name | Value |
|------|------|-------|
| A | @ (or yourdomain.com) | Your server's IPv4 address |
| A | www | Your server's IPv4 address |
| AAAA | @ (or yourdomain.com) | Your server's IPv6 address (if available) |
| AAAA | www | Your server's IPv6 address (if available) |

Alternatively, use a CNAME for www:

| Type | Name | Value |
|------|------|-------|
| A | @ | Your server's IPv4 address |
| AAAA | @ | Your server's IPv6 address (if available) |
| CNAME | www | yourdomain.com |

**Important:** Let's Encrypt validates over both IPv4 and IPv6. If you have AAAA records, ensure your server is accessible on port 80 over IPv6, or remove the AAAA records.

Verify DNS propagation before proceeding:
```bash
nslookup yourdomain.com
nslookup www.yourdomain.com
```

**2. Firewall Configuration**

Port 80 must be accessible from the internet for Let's Encrypt's HTTP-01 challenge:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

#### Setup Steps

**Step 1: Configure environment variables**

Add to your `.env` file (note the quotes around domains with spaces):
```bash
LETSENCRYPT_DOMAINS="yourdomain.com www.yourdomain.com"
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

**Step 2: Update nginx SSL config with your domain**

Edit `photo-gallery/nginx-ssl.conf` (lines 27-28) on your server:
```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

> **Note:** The repo contains `example.com` as a placeholder. You must change this on your production server before starting with SSL.

**Step 3: Obtain certificates (start without SSL first)**

First, start with the base compose file (HTTP only) to obtain certificates:
```bash
docker-compose up -d --build
```

Run the init script to test certificate issuance:
```bash
./init-letsencrypt.sh --dry-run
```

If successful, obtain real certificates:
```bash
./init-letsencrypt.sh
```

**Step 4: Switch to SSL configuration**

Stop the containers and restart with the production SSL config:
```bash
docker-compose down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| `no valid A records found` | DNS not configured or not propagated. Verify with `nslookup yourdomain.com` |
| `Connection refused` | Port 80 not open. Check firewall with `sudo ufw status` and verify container is running with `docker ps` |
| `404` on ACME challenge | Volume mount issue. Ensure `certbot/www` directory exists and container was started with `--force-recreate` |
| `cannot load certificate` in nginx logs | Certificate path in `nginx-ssl.conf` doesn't match your domain. Update lines 27-28 |
| Spaces in LETSENCRYPT_DOMAINS error | Wrap the value in quotes: `LETSENCRYPT_DOMAINS="domain.com www.domain.com"` |

#### What the production setup includes

- Automatic HTTP to HTTPS redirect
- Let's Encrypt certificate auto-renewal (checked every 12 hours)
- Nginx auto-reload to pick up renewed certificates
- Security headers (HSTS, X-Frame-Options, etc.)

### Local Development

**API:**
```bash
cd photo-api
npm install
npm run dev
```

**Frontend:**
```bash
cd photo-gallery
npm install
npm start
```

## Lightroom Plugin

The `PhotoGalleryPublish.lrplugin` allows publishing directly from Lightroom Classic:

1. Copy the `PhotoGalleryPublish.lrplugin` folder to your Lightroom plugins directory
2. In Lightroom, go to File > Plug-in Manager > Add
3. Configure the API URL and API key in the plugin settings
4. Create a Published Collection and start publishing

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Lightroom     │────▶│    photo-api    │◀────│  photo-gallery  │
│    Plugin       │     │   (Express.js)  │     │    (Angular)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │     MariaDB     │
                        └─────────────────┘
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /photos | List all photos |
| GET | /photos/:id | Get photo details |
| GET | /photos/:id/:size | Get photo image (display/featured/thumb) |
| POST | /photos | Upload new photo |
| PUT | /photos/:id | Update photo metadata |
| DELETE | /photos/:id | Delete photo |
| GET | /collections | List collections |
| POST | /collections | Create collection |
| DELETE | /collections/:id | Delete collection |
| GET | /health | Health check |

## Environment Variables

Create a `.env` file from the example:
```bash
cp .env.example .env
```

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | Database host | mariadb |
| DB_PORT | Database port | 3306 |
| DB_NAME | Database name | photo_db |
| DB_USER | Database user | photo_user |
| DB_PASSWORD | Database password | - |
| MARIADB_ROOT_PASSWORD | MariaDB root password | - |

### Frontend Configuration

These variables are injected at build time into the Angular frontend:

| Variable | Description | Default |
|----------|-------------|---------|
| NG_APP_SITE_NAME | Site title displayed in header | Photography |
| NG_APP_COPYRIGHT_YEAR | Copyright year in footer | 2024 |
| NG_APP_COPYRIGHT_HOLDER | Copyright holder name | Your Name |
| NG_APP_INSTAGRAM_URL | Instagram profile link | - |
| NG_APP_CONTACT_EMAIL | Contact email address | - |
| NG_APP_SHOW_LOCATION_LINK | Show Google Maps link for photos with GPS | true |

**Note:** Frontend variables are baked into the JavaScript bundle during `docker compose build`. Changes require rebuilding the frontend image.

### SSL Configuration (Production)

| Variable | Description | Example |
|----------|-------------|---------|
| LETSENCRYPT_DOMAINS | Space-separated list of domains | example.com www.example.com |
| LETSENCRYPT_EMAIL | Email for Let's Encrypt notifications | admin@example.com |

## License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.
