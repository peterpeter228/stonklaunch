# No secrets or .env files are copied into this image. Build context allowlist below.
FROM node:24.19.0-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY scripts/verify-dependency.mjs ./scripts/verify-dependency.mjs
RUN pnpm install --frozen-lockfile --ignore-scripts && node scripts/verify-dependency.mjs

FROM dependencies AS build
COPY src ./src
COPY public ./public
COPY next.config.ts next-env.d.ts tsconfig.json postcss.config.mjs ./
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SOLANA_RPC_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL
RUN pnpm build

FROM build AS runtime
ENV NODE_ENV=production
USER node
EXPOSE 3000
# Dependencies are immutable at runtime. pnpm may attempt an automatic install
# when its root-owned build metadata differs under the unprivileged runtime user.
# Keep the safety gate, then replace the shell so Next receives shutdown signals.
CMD ["sh", "-c", "node scripts/verify-dependency.mjs && exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0"]
