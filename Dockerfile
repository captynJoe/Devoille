FROM python:3.12-alpine
WORKDIR /app
RUN apk add --no-cache jpeg-dev zlib-dev \
    && apk add --no-cache --virtual .build-deps build-base \
    && pip install --no-cache-dir Pillow \
    && apk del .build-deps
COPY . /app
ENV PORT=80
ENV DEVOILE_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 80
CMD ["python", "app.py"]
