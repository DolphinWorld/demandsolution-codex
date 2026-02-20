FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run prisma:generate && npm run build

ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

CMD ["sh", "-lc", "npx prisma db push && npm start -- -H 0.0.0.0 -p 7860"]
