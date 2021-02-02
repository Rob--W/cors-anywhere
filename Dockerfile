FROM node:15.7.0-alpine3.12
ADD package.json .
RUN npm install
ENV PORT=8080
ENV CORSANYWHERE_WHITELIST=https://google.co.uk
ADD ./lib ./lib
ADD server.js .
CMD ["node", "server.js"]

