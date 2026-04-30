FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir kafka-python-ng redis

COPY . .

RUN mkdir -p app/uploads

EXPOSE 8000

CMD ["python", "run.py"]
