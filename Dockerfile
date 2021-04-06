FROM node:14

COPY {package*.json,yarn.lock} ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn prod

CMD [ "yarn", "start" ]
