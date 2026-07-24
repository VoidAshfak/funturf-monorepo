FROM node:current-alpine3.21

WORKDIR /funturf/app

COPY package*.json ./

RUN npm install && apk add --no-cache curl

COPY . .

RUN npm run prisma:generate

EXPOSE 8080

# Run node directly — NOT through `npm run`.
#
# The process that receives the container's SIGTERM must be the one with the
# shutdown handler (src/index.js), because that handler is what releases this
# replica's PostgreSQL connections before the container dies. `npm` in the middle
# would take the signal itself and may not forward it, so the pool would leak
# through every deploy — see the pool budget in src/prisma.js.
#
# A start command configured on the platform (Render dashboard) or a `command:`
# in docker-compose.yml overrides this; keep those on `node src/index.js` too.
CMD [ "node", "src/index.js" ]

