FROM python:3.12-slim

WORKDIR /seed

COPY infrastructure/seed-runner/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY infrastructure/seed-runner/seed_all.py ./seed_all.py
COPY infrastructure/seed-runner/entrypoint.sh ./entrypoint.sh
COPY services/job-service/data/sample_jobs.csv /data/sample_jobs.csv

RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
