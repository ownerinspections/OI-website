FROM node:alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm i --no-frozen-lockfile
COPY . .

RUN pnpm run build
EXPOSE 8030
CMD ["pnpm", "start"]