FROM node:14

# this fixes a nodemon bug
WORKDIR /app 

# cache deps
COPY package.json yarn.lock /app/
RUN yarn install --frozen-lockfile

# setup project
COPY . /app/
RUN yarn build

CMD [ "yarn", "start" ]
