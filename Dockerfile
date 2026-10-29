# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Build-time env vars for Vite (baked into the bundle)
ARG VITE_APP_MODE=server
ARG VITE_API_URL
ARG VITE_ENABLE_COLLAB=true

ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ENABLE_COLLAB=$VITE_ENABLE_COLLAB

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
