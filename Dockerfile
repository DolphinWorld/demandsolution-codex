FROM node:20-bookworm-slim

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV DATABASE_URL="file:./dev.db"
ENV OPENAI_API_KEY=""
ENV OPENAI_MODEL="gpt-4.1-mini"
ENV NODE_ENV=production
ENV PORT=7860

RUN npm run prisma:generate && npm run build

EXPOSE 7860

CMD ["sh", "-lc", "npx prisma db push --skip-generate && npm start -- -H 0.0.0.0 -p ${PORT}"]
