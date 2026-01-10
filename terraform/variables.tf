
variable "mq_host" {
  description = "The RabbitMQ server host address"
  type        = string
  default     = "localhost"
}

variable "mq_management_port" {
  description = "The RabbitMQ Management API port (HTTP)"
  type        = number
  default     = 15672
}

variable "mq_user" {
  description = "The RabbitMQ admin username"
  type        = string
  sensitive   = true
}

variable "mq_pass" {
  description = "The RabbitMQ admin password"
  type        = string
  sensitive   = true
}
