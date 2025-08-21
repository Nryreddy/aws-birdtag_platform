############ 1️⃣ Builder Stage ################################################
FROM python:3.10-slim AS builder

ENV PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .

# Install CPU-only Torch + Ultralytics et al. into /build/python
RUN pip install --upgrade pip && \
    pip install --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.txt -t python/

############ 2️⃣ Lambda Runtime ###############################################
FROM public.ecr.aws/lambda/python:3.10

# Runtime libs for OpenCV
RUN yum install -y mesa-libGL glib2 && yum clean all

# Site-packages from builder 
COPY --from=builder /build/python /opt/python

WORKDIR /var/task
COPY lambda_handler.py image_video_tagger.py ./

CMD ["lambda_handler.lambda_handler"]
