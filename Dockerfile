FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage: run Express server
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend and server.js
COPY --from=build /app/dist ./dist
COPY server.js ./

# Expose port
EXPOSE 3000

# Start the Express server
CMD ["node", "server.js"]
