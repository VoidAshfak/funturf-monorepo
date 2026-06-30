FROM node:current-alpine3.21

WORKDIR /funturf/app

COPY package*.json ./

RUN npm install && apk add --no-cache curl

COPY . .

RUN npm run prisma:generate

EXPOSE 8080

# CMD [ "npm", "run", "dev" ]

