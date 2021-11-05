FROM node:14

# this fixes a nodemon bug
WORKDIR /app

# build xsnap
RUN (git clone https://github.com/Agoric/agoric-sdk/ /tmp/xsnap && cd /tmp/xsnap/packages/xsnap && yarn && yarn build)
COPY /tmp/xsnap/packages/xsnap/xsnap-native node_modules/@agoric/xsnap/

# cache deps
COPY package.json yarn.lock /app/
RUN yarn install --frozen-lockfile

# setup project
COPY . /app/
RUN yarn build

CMD [ "yarn", "start" ]
