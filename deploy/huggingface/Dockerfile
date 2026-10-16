# Hugging Face Space (SDK: Docker). Runs the backend (public, port 7860) and the
# retrieval service (private, port 8001) in one container. The code is pulled from GitHub at build time.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face runs containers as user 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/home/user/.cache/huggingface
WORKDIR $HOME

ARG REPO_URL=https://github.com/akshayks13/Plant-Pulse.git
ARG REPO_REF=deploy
RUN git clone --depth 1 --branch ${REPO_REF} ${REPO_URL} app
WORKDIR $HOME/app

# CPU-only PyTorch (the default wheel is several times larger), then everything else
RUN pip install --no-cache-dir torch==2.14.1 torchvision==0.29.1 \
        --index-url https://download.pytorch.org/whl/cpu
RUN grep -v -E '^(torch|torchvision)==' apps/backend/requirements.txt > /tmp/backend-req.txt \
    && pip install --no-cache-dir -r /tmp/backend-req.txt -r apps/retrieval/requirements.txt

# Bake the embedding model into the image so start-up does not download it
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"

ENV DEBUG=false
EXPOSE 7860
CMD ["bash", "deploy/huggingface/start.sh"]
