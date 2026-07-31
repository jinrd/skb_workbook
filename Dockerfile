FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm config set dangerouslyAllowAllBuilds true \
  && pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate

ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV SESSION_SECRET=build-only-session-secret
ENV GOOGLE_OAUTH_CLIENT_ID=build-only
ENV GOOGLE_OAUTH_CLIENT_SECRET=build-only
ENV GOOGLE_OAUTH_REFRESH_TOKEN=build-only
ENV GOOGLE_DRIVE_FOLDER_ID=build-only
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]