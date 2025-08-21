# Build stage
FROM public.ecr.aws/lambda/python:3.10 AS builder
RUN yum -y install zip && yum clean all && rm -rf /var/cache/yum
RUN pip install --no-cache-dir opencv-python-headless numpy -t /opt/python && \
    find /opt/python -type d -name "tests" -exec rm -rf {} + && \
    find /opt/python -type f -name "*.pyc" -delete && \
    rm -rf /opt/python/**/*.dist-info/RECORD
RUN cd /opt && zip -r9q opencv_layer.zip python

# Final stage
FROM scratch AS export
COPY --from=builder /opt/opencv_layer.zip /
