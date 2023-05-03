# Use a Node.js base image with version 14
FROM node:16

# Create a working directory in the container
WORKDIR /app

# Move package.json and package-lock.json
COPY package.json .
COPY package-lock.json .

# Install dependencies from package-lock.json
RUN npm ci && npm cache clean --force

# Copy the server.js file from the local filesystem to the container
COPY lib ./lib
COPY server.js .

# Install any dependencies needed for the server
# RUN npm run lint

# Set the command to execute when the container starts
CMD ["node", "server.js"]
