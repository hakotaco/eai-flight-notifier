
output "vhost_name" {
  description = "The name of the created Virtual Host"
  value       = rabbitmq_vhost.flight_ops.name
}

output "exchange_name" {
  description = "The primary event exchange"
  value       = rabbitmq_exchange.flight_events.name
}

output "queue_name" {
  description = "The notification queue"
  value       = rabbitmq_queue.delay_notifications.name
}
