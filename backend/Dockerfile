FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Use ts-node for development
CMD ["npm", "run", "dev"]