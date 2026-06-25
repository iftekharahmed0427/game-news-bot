FROM node:20-alpine
WORKDIR /app

# Install deps first for layer caching.
COPY package.json ./
RUN npm install

COPY . .

# State lives here; mount a volume so it survives restarts.
ENV STATE_FILE=/app/data/state.json
VOLUME ["/app/data"]

CMD ["npm", "start"]
