# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Run stage ----
FROM node:20-alpine
WORKDIR /app

# Install a static file server
RUN npm i -g serve

# Copy built site
COPY --from=build /app/dist /app/dist

EXPOSE 3000

# IMPORTANT: run via shell so ${PORT} expands (Railway sets PORT)
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
