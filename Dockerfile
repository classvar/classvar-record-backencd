FROM node:14

WORKDIR /classvar-webrtc

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run gen-pem

ENV RECORD_SERVER_IP localhost

ENV RECORD_SERVER_PORT 3000

EXPOSE 3000

ENTRYPOINT npm run start-serverside
