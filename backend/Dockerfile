FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 🔥 BUILD STEP MISSING BEFORE
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/server.js"]