FROM harbor.jinqidongli.com/library/node:20.19
WORKDIR /app
COPY . .
RUN npm run build-client
CMD ["npm", "run", "start"]
EXPOSE 3000
