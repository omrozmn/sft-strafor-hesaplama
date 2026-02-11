# Stage 1: Build React Frontend
FROM node:18-alpine as builder
WORKDIR /app
COPY src/frontend/package*.json ./
RUN npm install
COPY src/frontend/ .
RUN npm run build

# Stage 2: Python Backend
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY src/ src/

# Copy Frontend Build to static
# Remove old static files first if any (though Docker copy overlays)
# We overwrite src/static with the build output
COPY --from=builder /app/dist /app/src/static

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "80"]
