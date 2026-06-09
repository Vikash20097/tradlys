FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./
COPY frontend/ ./public/

EXPOSE 5000

CMD ["npm", "start"]
