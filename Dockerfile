FROM node:20

RUN curl -fsSL https://get.docker.com | sh

WORKDIR /app
COPY . /app

CMD ["bash", "-c", "npm install && npm start"]
