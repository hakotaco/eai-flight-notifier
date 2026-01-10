###########
# Builder #
###########
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only npm manifests to leverage Docker layer caching
COPY package*.json ./

# Install all deps (including dev) for building; fall back to npm install if no lockfile
RUN npm ci || npm install

# Copy sources and tsconfig then build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

##########
# Runner #
##########
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy only package manifests and install production deps
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# The app reads and writes under /app/data; allow mounting a volume
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["npm", "start"]
