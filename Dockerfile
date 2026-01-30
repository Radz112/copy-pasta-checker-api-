FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled source and library data
COPY dist/ ./dist/
COPY src/config/library_of_legends.json ./dist/src/config/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
