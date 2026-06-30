FROM nginx:alpine

# Copy your config into the default location Nginx reads from
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTP
EXPOSE 80

# Use the default Nginx start command (keeps the container in the foreground)
# CMD ["nginx", "-g", "daemon off;"]
