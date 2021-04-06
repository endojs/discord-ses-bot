FROM node:14

# cache deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# setup project
COPY . .
RUN yarn prod

CMD [ "yarn", "start" ]
