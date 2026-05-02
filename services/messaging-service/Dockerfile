FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

ENV PYTHONPATH=/app
ENV PORT=3004

EXPOSE 3004

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3004}
