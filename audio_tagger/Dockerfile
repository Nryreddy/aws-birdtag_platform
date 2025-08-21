########################  1. BUILDER  ###############################
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      libsndfile1 libgl1 libglib2.0-0 ca-certificates curl xz-utils \
   && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt -t python/

########################  2. RUNTIME  ###############################
FROM public.ecr.aws/lambda/python:3.11

# runtime libs (libsndfile for soundfile, mesa-libGL for TF)
RUN yum install -y libsndfile mesa-libGL glib2 tar xz && yum clean all

# --- static ffmpeg (mp3 → wav) ---
RUN curl -L -o /tmp/ffmpeg.tar.xz \
      https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar -xf /tmp/ffmpeg.tar.xz -C /tmp && \
    cp /tmp/ffmpeg-*-amd64-static/{ffmpeg,ffprobe} /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe && \
    rm -rf /tmp/ffmpeg*

# Python deps
COPY --from=builder /build/python /opt/python

# Function code
WORKDIR /var/task
COPY app/audio_tagger.py .
COPY app/lambda_handler.py .

CMD ["lambda_handler.lambda_handler"]
