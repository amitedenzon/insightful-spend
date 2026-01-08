FROM node:20-alpine

WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install ALL dependencies (including devDependencies)
RUN npm install

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p server/data

# Expose Vite port (5173) and Server port (3001)
EXPOSE 5173
EXPOSE 3001

# Start in development mode
CMD ["npm", "run", "dev"]
