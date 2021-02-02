FROM node:15.7.0-alpine3.12
ADD package.json .
RUN npm install
ADD ./lib ./lib
ADD server.js .
ENV PORT=8080
ENV CORSANYWHERE_WHITELIST=https://google.co.uk
ENV REWRITE_URL=/v0/cors-anywhere
CMD ["node", "server.js"]

