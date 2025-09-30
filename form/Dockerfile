FROM node:alpine
WORKDIR /app

# Accept build arguments
ARG KONG_GATEWAY_URL
ARG STRIPE_SECRET_KEY
ARG VERIFY_SERVICE_SID
ARG APP_BASE_URL
ARG CLIENT_ROLE_ID

# Set environment variables for build
ENV KONG_GATEWAY_URL=$KONG_GATEWAY_URL
ENV STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
ENV VERIFY_SERVICE_SID=$VERIFY_SERVICE_SID
ENV APP_BASE_URL=$APP_BASE_URL
ENV CLIENT_ROLE_ID=$CLIENT_ROLE_ID

COPY package*.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm i --no-frozen-lockfile
COPY . .

RUN pnpm run build
EXPOSE 8030
CMD ["pnpm", "start"]