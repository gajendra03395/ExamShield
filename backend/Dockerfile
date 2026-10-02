FROM node:22-bookworm-slim
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
EXPOSE 5000
