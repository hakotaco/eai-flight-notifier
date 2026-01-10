
# Get Terraform binary
FROM docker.io/hashicorp/terraform:1.13.0 AS terraform

ENTRYPOINT []

WORKDIR /app/terraform

COPY terraform/ .

CMD ["sh", "-c", "terraform init && terraform apply -auto-approve && tail -f /dev/null"]
