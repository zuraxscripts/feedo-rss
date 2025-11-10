FROM oven/bun:latest

RUN apt-get update -qq

COPY package.json ./
COPY tsconfig.json ./
COPY config.default.ts ./config.ts
COPY src ./src

RUN bun install

ENTRYPOINT [ "bun", "start" ]
