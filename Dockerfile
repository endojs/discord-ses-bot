FROM node:14

COPY {package*.json,yarn.lock} ./
RUN yarn install

COPY . .
RUN yarn prod

CMD [ "yarn", "start" ]
