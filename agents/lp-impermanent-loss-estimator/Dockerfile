FROM node:22-alpine

WORKDIR /app

# Install runtime deps only
COPY package*.json ./
RUN npm install --omit=dev

COPY ./dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server.js"]
