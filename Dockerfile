FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Yarn 4 comes from Corepack, pinned by "packageManager" in package.json.
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY app.js render.js config.json ./

# state.json (candidate pool and articles already sent) lives in a volume so it survives restarts.
ENV STATE_PATH=/data/state.json
RUN mkdir /data && chown node:node /data
VOLUME /data

USER node
ENTRYPOINT ["node", "app.js"]
CMD ["run"]
