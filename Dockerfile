FROM node:22-alpine

WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci && npm cache clean --force

# Copy source
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

EXPOSE 3000

CMD ["npm", "start"]
