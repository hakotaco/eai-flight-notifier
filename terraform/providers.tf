
terraform {
  required_providers {
    rabbitmq = {
      source  = "cyrilgdn/rabbitmq"
      version = "1.10.1"
    }
  }
}

provider "rabbitmq" {
  # Terraform connect to Management API (HTTP), not AMQP (5672)
  endpoint = "http://${var.mq_host}:${var.mq_management_port}"
  username = var.mq_user
  password = var.mq_pass
}
