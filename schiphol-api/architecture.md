# Project Structure

## Directory Structure

Given the complexity of the project, the directory structure is as follows:

```
ams-flight-ingestion
├── src
│   ├── config
│   │   └── flight-schema.ts
│   ├── core
│   │   ├── entities
│   │   │   └── FlightState.ts
│   │   └── repositories
│   │       └── FlightStateRepository.ts
│   ├── services
│   │   └── SchipholService.ts
│   └── index.ts
├── test
│   └── config
│       └── flight-schema.test.ts
├── .env
├── .env.example
├── architecture.md
├── README.md
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── yarn.lock
```

## Data Flow Overview

### Backend Class Diagram

The Backend Class Diagram is designed as follows:

```mermaid
flowchart TD
    %% Define styles
    classDef storage fill:#f9f,stroke:#333,stroke-width:2px;
    classDef external fill:#eee,stroke:#999,stroke-dasharray: 5 5;
    classDef logic fill:#e1f5fe,stroke:#01579b;

    %% External dependencies
    subgraph External_World [External World]
        Schiphol_API[Schiphol API]:::external
    end

    %% Core application
    subgraph App [Backend Application]
        direction TB

        %% 1. Driver layer
        Producer[AMSFlightProducer]:::logic
        note_poll[Loop: Poll Interval]

        %% 2. Adapter layer (Gate 1)
        Adapter[FlightAPIAdapter]:::logic
        note_zod[Zod Validation & Cleaning]

        %% 3. Logic layer (The Core - Stateful)
        Detector[DelayDetectionModule]:::logic

        %% 4. Formatting and sending
        Formatter[EventFormatter]:::logic
        Publisher[MessagePublisher]:::logic
    end

    %% Persistence layer (Fix: Add DB)
    subgraph Persistence [Persistence Layer]
        DB[(PostgreSQL)]:::storage
        Repo["FlightStateRepository (TypeORM)"]:::storage
    end

    %% Message queue
    subgraph Messaging [Infrastructure]
        MQ(RabbitMQ):::external
        CMS[CMS Consumer]:::external
    end

    %% Connection relationships
    note_poll -.-> Producer
    Producer -- "1. pollFlightData()" --> Adapter
    Adapter -- "2. GET /flights" --> Schiphol_API
    Schiphol_API -- "JSON" --> Adapter
    Adapter -- "3. FlightData[] (Safe Object)" --> Detector

    %% Key fix: State read/write
    Detector -- "4. Find Previous State (mainFlight + date)" --> Repo
    Repo <--> DB
    Detector -- "5. Compare & Save New State" --> Repo

    %% Trigger notification flow
    Detector -- "6. If State Changed then (Delay Detected)" --> Formatter
    Formatter -- "7. Format Payload" --> Publisher
    Publisher -- "8. Publish Event" --> MQ
    MQ --> CMS

    %% Comment connection
    Adapter -.- note_zod
```

### TypeScript Code Flow

The Backend Code Flow corresponding to the Backend Class Diagram is designed as follows such that the SoC and IoC principles are adhered to.

1. **Gate 1: Input Validation by `Zod`**

    Responsible for validating and converting the untrusted `Raw JSON` into a clean `TypeScript Object`. If the format is incorrect, it will be discarded here.

2. **The Transformation Layer for Business Logic**

    Receives the clean object, performs business operations (e.g., calculating delay time, filtering duplicate data), and assembles it into a `TypeORM Entity` that matches the database structure.

3. **Gate 2: Persistence Constraints by TypeORM**

    Responsible for executing SQL writes. At this stage, it checks database-level constraints, such as Primary Key conflicts and Foreign Key associations, to ensure database integrity.

```mermaid
flowchart LR
    subgraph External["External World (Untrusted)"]
        API[Schiphol API]
        RawJSON[Raw JSON Payload]
    end

    subgraph Application["Backend Application (Trusted)"]
        direction TB

        Gate1{{Gate 1: Zod Schema}}
        Transform[Logic & Transform]
        Gate2{{Gate 2: TypeORM}}

        Gate1 --"Parsed (Safe Object)"--> Transform
        Transform --"Mapped (Entity)"--> Gate2
    end

    subgraph Storage["Persistence Layer"]
        DB[(PostgreSQL)]
    end

    Bin(Error Log / Discard)

    %% Connections
    API --> RawJSON
    RawJSON --> Gate1

    Gate1 --"Invalid"--> Bin
    Gate2 --"Constraint Violation"--> Bin

    Gate2 --> DB
```
