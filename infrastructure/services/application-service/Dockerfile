FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

RUN mkdir -p src/uploads/resumes

EXPOSE 5003

CMD ["node", "src/server.js"]
