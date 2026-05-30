# Stage 1: Build the Static Next.js Application
FROM node:18-alpine AS builder
WORKDIR /app

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Install both general and dev dependencies for compiling Next
COPY package*.json ./
RUN npm ci

# Copy core modules
COPY . .

# Generate Client bindings inside container
RUN npx prisma generate

# Execute compilation build (Targeting Next Static output directory)
RUN npm run build

# Stage 2: Production runtime assembly 
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copy built schemas, clients, and assets
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/out ./out

# Standard environment generation
RUN npx prisma generate

EXPOSE 5000

# Execute relational migrations, push schemas, and startup API
CMD ["sh", "-c", "npx prisma db push && node server.js"]
