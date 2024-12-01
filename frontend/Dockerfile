# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code and build it
COPY . .
RUN npm run build

# Stage 2: Serve the build
FROM nginx:alpine AS production

# Copy the built application from the first stage
COPY --from=build /app/dist /usr/share/nginx/html
# Expose port 80 for the web server
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
