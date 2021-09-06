FROM node:lts-alpine

RUN mkdir -p /app
WORKDIR /app

COPY package.json server.js /app/
COPY lib /app/lib/
RUN npm install

ENV CORSANYWHERE_TARGET_WHITELIST "^https?:\/\/duckduckgo\.com"

CMD [ "node", "/app/server.js" ]
EXPOSE 8080
