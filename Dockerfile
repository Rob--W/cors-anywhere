FROM node:15.7.0-alpine3.12
ADD package.json .
RUN npm install
ADD ./lib ./lib
ADD server.js .
ENV PORT=8080
ENV REWRITE_URL=/v0/cors-anywhere
ENV CORSANYWHERE_WHITELIST
CMD ["node", "server.js"]

