FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
ENV PORT=7000 DB_PATH=/data/addon.sqlite
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 7000
CMD ["node","src/server.js"]
