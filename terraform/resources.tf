
# 1. Virtual Host (Isolation)
resource "rabbitmq_vhost" "flight_ops" {
  name = "flight_ops"
}

# 2. Permissions
resource "rabbitmq_permissions" "admin_flight_ops" {
  user  = var.mq_user
  vhost = rabbitmq_vhost.flight_ops.name

  permissions {
    configure = ".*"
    write     = ".*"
    read      = ".*"
  }
}

# 3. Exchange (Topic Strategy)
resource "rabbitmq_exchange" "flight_events" {
  depends_on = [rabbitmq_permissions.admin_flight_ops]

  name  = "flight.events"
  vhost = rabbitmq_vhost.flight_ops.name

  settings {
    type    = "topic"
    durable = true
  }
}

# 4. Queue (Consumer Endpoint)
resource "rabbitmq_queue" "delay_notifications" {
  depends_on = [rabbitmq_permissions.admin_flight_ops]

  name  = "flight.delay_notifications"
  vhost = rabbitmq_vhost.flight_ops.name

  settings {
    durable = true
  }
}

# 5. Binding (Routing Logic)
resource "rabbitmq_binding" "events_to_notifications" {
  source           = rabbitmq_exchange.flight_events.name
  vhost            = rabbitmq_vhost.flight_ops.name
  destination      = rabbitmq_queue.delay_notifications.name
  destination_type = "queue"
  routing_key      = "flight.delayed"
}
