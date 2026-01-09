# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

# ---- Run stage ----
FROM node:20-alpine
WORKDIR /app

RUN npm i -g serve
COPY --from=build /app/dist /app/dist

EXPOSE 3000

# IMPORTANT: explicit TCP endpoint so serve doesn't error
CMD ["sh", "-c", "serve -s dist --listen tcp://0.0.0.0:${PORT:-3000}"]
