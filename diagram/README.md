# Flight Delay Notifier - UML Diagrams

This directory contains PlantUML diagrams for the Flight Delay Notifier university project.

## Diagrams Included

1. **flight-notifier.puml** - Component/Architecture Diagram
   - Shows the overall system architecture
   - Displays components of the central service
   - Shows integration with RabbitMQ message queues
   - Illustrates database structure and external services

2. **class-diagram.puml** - Class Diagram
   - Defines the domain models (User, Flight, NotificationSchedule, etc.)
   - Shows service classes and their responsibilities
   - Includes repository interfaces for database operations
   - Displays enums for status types

3. **sequence-diagram.puml** - Sequence Diagram
   - Illustrates the flow from user registration to notification
   - Shows message queue processing
   - Demonstrates how updates trigger notifications

## How to View These Diagrams

### Online Tools (Free)

1. **PlantUML Online Editor**: https://www.plantuml.com/plantuml/uml/
   - Copy and paste the content of any `.puml` file
   - The diagram will render automatically

2. **PlantText**: https://www.planttext.com/
   - Another online PlantUML editor
   - Simple interface

3. **PlantUML QEditor**: https://qeditor.plantuml.com/
   - Online editor with additional features

### VS Code Extension

1. Install the "PlantUML" extension by jebbs
2. Open any `.puml` file
3. Press `Alt+D` (or `Option+D` on Mac) to preview

### Generate Images

You can also generate PNG/SVG images using:
```bash
# Install PlantUML (requires Java)
brew install plantuml

# Generate PNG
plantuml flight-notifier.puml

# Generate SVG
plantuml -tsvg flight-notifier.puml
```

## System Overview

The central service is responsible for:
- User registration and authentication
- Flight registration and tracking
- Calculating optimal notification times
- Consuming updates from RabbitMQ queues
- Monitoring flights for significant changes
- Dispatching email notifications to users

External services (not shown in detail):
- **Schiphol Service**: Polls Schiphol API, publishes flight updates
- **Google Maps Service**: Polls traffic data, publishes traffic updates

The system maintains statelessness by storing all data in a database and using message queues for inter-service communication.
