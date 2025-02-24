FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Set permissions for executable
RUN chmod +x dist/index.js

# Expose the server port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
