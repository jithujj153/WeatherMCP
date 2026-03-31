FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install app dependencies using package.json and package-lock.json
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build the TypeScript project to /dist
RUN npm run build

# Install Python for google-adk integration
RUN apk add --no-cache python3 py3-pip
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install google-adk mcp

# Cloud Run expected port
EXPOSE 8080

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

CMD [ "npm", "start" ]
