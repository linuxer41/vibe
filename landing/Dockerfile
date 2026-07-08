FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production PORT=5173
EXPOSE 5173
VOLUME /app/binaries
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "build/index.js"]
