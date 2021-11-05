FROM node:14

# this fixes a nodemon bug
WORKDIR /app

# cache deps
COPY package.json yarn.lock /app/
RUN yarn install --frozen-lockfile

# build xsnap
RUN (git clone https://github.com/Agoric/agoric-sdk/ /tmp/xsnap && (cd /tmp/xsnap/packages/xsnap && yarn && yarn build) && cp -r /tmp/xsnap/packages/xsnap/xsnap-native ./xsnap-native )

# setup project
COPY . /app/
RUN yarn build

CMD [ "yarn", "start" ]
