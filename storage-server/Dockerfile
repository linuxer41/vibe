FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /tmp/node_modules
RUN npm ci

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p media cache
ENV NODE_ENV=production PORT=3002
EXPOSE 3002
VOLUME ["/app/media", "/app/cache"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
