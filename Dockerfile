FROM node:14

# this fixes a nodemon bug
WORKDIR /app

# cache deps
COPY package.json yarn.lock /app/
RUN yarn install --frozen-lockfile

# build xsnap
RUN (git clone https://github.com/Agoric/agoric-sdk/ /tmp/xsnap && (cd /tmp/xsnap/packages/xsnap && git checkout 8d442a9bdc41520003299c3452e74f5e9f0b7144 && yarn && yarn build) && cp -r /tmp/xsnap/packages/xsnap/xsnap-native ./xsnap-native )

# setup project
COPY . /app/
RUN yarn build

CMD [ "yarn", "start" ]
