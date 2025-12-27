# Stage 1: Build the Angular application
FROM node:20-alpine AS build

WORKDIR /app

# Build arguments passed from docker-compose
ARG NG_APP_SITE_NAME
ARG NG_APP_COPYRIGHT_YEAR
ARG NG_APP_COPYRIGHT_HOLDER
ARG NG_APP_INSTAGRAM_URL
ARG NG_APP_CONTACT_EMAIL
ARG NG_APP_SHOW_LOCATION_LINK

# Convert to environment variables for ngx-env
ENV NG_APP_SITE_NAME=$NG_APP_SITE_NAME
ENV NG_APP_COPYRIGHT_YEAR=$NG_APP_COPYRIGHT_YEAR
ENV NG_APP_COPYRIGHT_HOLDER=$NG_APP_COPYRIGHT_HOLDER
ENV NG_APP_INSTAGRAM_URL=$NG_APP_INSTAGRAM_URL
ENV NG_APP_CONTACT_EMAIL=$NG_APP_CONTACT_EMAIL
ENV NG_APP_SHOW_LOCATION_LINK=$NG_APP_SHOW_LOCATION_LINK

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist/photo-gallery/browser /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
