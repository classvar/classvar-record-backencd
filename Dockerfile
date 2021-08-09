FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run gen-pem

EXPOSE 3000

ENTRYPOINT npm run start-serverside
