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
   git clone https://github.com/yourusername/photo-website-two.git
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
   docker-compose exec api npm run set-api-key YOUR_GENERATED_KEY
   ```
   Save this key - you'll need it for the Lightroom plugin.

5. Access the application:
   - Frontend: http://localhost:8081
   - API: http://localhost:3000 (internal)

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

## License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.
