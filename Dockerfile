FROM node:20-bookworm-slim

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Use /data for SQLite in Spaces (persistent when HF Persistent Storage is enabled).
RUN mkdir -p /data
ENV DATABASE_URL="file:/data/dev.db"
ENV OPENAI_API_KEY=""
ENV OPENAI_MODEL="gpt-4.1-mini"
ENV AUTH_SECRET="change-me-in-production"
ENV AUTH_GOOGLE_ID=""
ENV AUTH_GOOGLE_SECRET=""
ENV AUTH_URL="https://jacksuyu-demandsolution-codex.hf.space"
ENV NEXTAUTH_URL="https://jacksuyu-demandsolution-codex.hf.space"
ENV AUTH_TRUST_HOST="true"
ENV NODE_ENV=production
ENV PORT=7860

RUN npm run prisma:generate && npm run build

EXPOSE 7860

CMD ["sh", "-lc", "mkdir -p /data && npx prisma db push --skip-generate && npm start -- -H 0.0.0.0 -p ${PORT}"]
