# The toon-guide service, built by Railway from GitHub on every push to main.
# The repo has no web/public, so Caddy serves the built app and forwards every other path
# (/assets/*.glb, /blend, /ref, /shots, /goal) to the toon-guide-assets service; see web/Caddyfile.
FROM node:22-alpine AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY web/Caddyfile /etc/caddy/Caddyfile
