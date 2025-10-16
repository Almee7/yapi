FROM harbor.jinqidongli.com/library/node:20.19
WORKDIR /app
RUN yarn config set grpc_node_pre_gyp_mirror https://npmmirror.com/mirrors/grpc-tools
COPY package.json yarn.lock ./
RUN yarn install --ignore-engines --frozen-lockfile
COPY . .
RUN yarn build-client
CMD ["yarn", "start"]
EXPOSE 3000