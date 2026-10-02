FROM node:22-bookworm-slim
WORKDIR /app
COPY web-panel/package.json web-panel/package-lock.json ./
RUN npm ci
COPY web-panel ./
EXPOSE 5173
