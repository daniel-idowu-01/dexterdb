FROM node:18-slim AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:18-slim
WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /usr/src/app/dist ./dist

ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
