FROM node:20

RUN curl -fsSL https://get.docker.com | sh
RUN apt-get update && apt-get install -y net-tools grep

WORKDIR /app
COPY . /app

CMD ["bash", "-c", "npm install && npm start"]
