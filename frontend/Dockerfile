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

RUN npm i -g http-server
COPY --from=build /app/dist /app/dist

EXPOSE 3000
CMD ["sh", "-c", "echo PORT=${PORT}; http-server /app/dist -a 0.0.0.0 -p ${PORT:-3000}"]
