# API Documentation - Member 4: Messaging & Connection Services

## 4. Messaging Service (threads + messages)

The Messaging Service manages conversation threads and real-time messages between members and recruiters on the platform.

**Base URL:** `http://localhost:3004/api/messaging`
**Database:** MongoDB (messages collection)
**Kafka Topics Produced:** `message.sent`

---

### Open / Create Thread

Opens or creates a new message thread between participants.

- **Endpoint:** `POST /api/messaging/threads/open`
- **Request Body:**
```json
{
  "participant_ids": ["M001", "R001"]
}
```
- **Success Response (200):**
```json
{
  "thread_id": "T001",
  "participants": [
    { "user_id": "M001", "name": "John Doe", "role": "member" },
    { "user_id": "R001", "name": "Jane Smith", "role": "recruiter" }
  ],
  "created_at": "2026-04-05T12:00:00Z",
  "message": "Thread created successfully"
}
```
- **Failure Cases:**
  - Participant not found
  - Invalid participant IDs
  - Thread already exists between these users (returns existing thread)

---

### Get Thread Metadata

Returns thread metadata including participants and last activity timestamp.

- **Endpoint:** `POST /api/messaging/threads/get`
- **Request Body:**
```json
{
  "thread_id": "T001"
}
```
- **Success Response (200):**
```json
{
  "thread_id": "T001",
  "participants": [
    { "user_id": "M001", "name": "John Doe", "role": "member" },
    { "user_id": "R001", "name": "Jane Smith", "role": "recruiter" }
  ],
  "created_at": "2026-04-05T12:00:00Z",
  "last_message_at": "2026-04-06T09:30:00Z",
  "message_count": 5
}
```
- **Failure Cases:**
  - Thread not found
  - Invalid thread_id

---

### List Messages in Thread

Returns all messages in a given thread ordered by timestamp.

- **Endpoint:** `POST /api/messaging/messages/list`
- **Request Body:**
```json
{
  "thread_id": "T001"
}
```
- **Success Response (200):**
```json
{
  "thread_id": "T001",
  "total_messages": 3,
  "messages": [
    {
      "message_id": "MSG001",
      "sender_id": "M001",
      "sender_name": "John Doe",
      "message_text": "Hi Jane, I saw the Senior Software Engineer posting and wanted to learn more about the team.",
      "timestamp": "2026-04-05T12:05:00Z",
      "status": "sent"
    },
    {
      "message_id": "MSG002",
      "sender_id": "R001",
      "sender_name": "Jane Smith",
      "message_text": "Hi John! Thanks for reaching out. The team works on distributed backend services.",
      "timestamp": "2026-04-05T12:10:00Z",
      "status": "sent"
    }
  ]
}
```
- **Failure Cases:**
  - Thread not found
  - No messages in thread

---

### Send Message

Sends a message within a thread. Supports **idempotency** via `idempotency_key` to safely retry on failure.

- **Endpoint:** `POST /api/messaging/messages/send`
- **Request Body:**
```json
{
  "thread_id": "T001",
  "sender_id": "M001",
  "sender_name": "John Doe",
  "message_text": "That sounds great! I just submitted my application.",
  "idempotency_key": "unique-client-generated-key"
}
```
- **Success Response (200):**
```json
{
  "message_id": "MSG003",
  "thread_id": "T001",
  "sender_id": "M001",
  "sender_name": "John Doe",
  "message_text": "That sounds great! I just submitted my application.",
  "timestamp": "2026-04-05T12:15:00Z",
  "status": "sent",
  "message": "Message sent successfully"
}
```
- **Kafka Event Produced:** `message.sent`
```json
{
  "event_type": "message.sent",
  "trace_id": "uuid",
  "timestamp": "2026-04-05T12:15:00Z",
  "actor_id": "M001",
  "entity": "T001",
  "payload": {
    "message_id": "MSG003",
    "thread_id": "T001",
    "sender_id": "M001",
    "message_text": "That sounds great!...",
    "timestamp": "2026-04-05T12:15:00Z"
  },
  "idempotency_key": "uuid"
}
```
- **Failure Cases:**
  - Thread not found
  - Sender is not a participant
  - Missing required fields
  - Message send failure (client should retry with same idempotency_key)

---

### List Threads by User

Returns all threads a user participates in, sorted by most recent activity.

- **Endpoint:** `POST /api/messaging/threads/byUser`
- **Request Body:**
```json
{
  "user_id": "M001"
}
```
- **Success Response (200):**
```json
{
  "user_id": "M001",
  "total_threads": 2,
  "threads": [
    {
      "thread_id": "T001",
      "participants": [...],
      "created_at": "2026-04-05T12:00:00Z",
      "last_message_at": "2026-04-06T09:30:00Z",
      "message_count": 5
    }
  ]
}
```
- **Failure Cases:**
  - user_id is required

---

## 5. Connection Service (requests + network)

The Connection Service manages LinkedIn-style connections between users: send requests, accept, reject, list connections, and find mutual connections.

**Base URL:** `http://localhost:3005/api/connections`
**Database:** MySQL (connections table)
**Kafka Topics Produced:** `connection.requested`, `connection.accepted`

### Database Schema
```sql
CREATE TABLE connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  connection_id VARCHAR(50) UNIQUE NOT NULL,
  requester_id VARCHAR(50) NOT NULL,
  receiver_id VARCHAR(50) NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_connection (requester_id, receiver_id),
  INDEX idx_requester (requester_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_status (status)
);
```

---

### Send Connection Request

Sends a connection request from one user to another.

- **Endpoint:** `POST /api/connections/request`
- **Request Body:**
```json
{
  "requester_id": "M001",
  "receiver_id": "M002"
}
```
- **Success Response (201):**
```json
{
  "success": true,
  "message": "Connection request sent successfully",
  "data": {
    "connection_id": "CON12345678",
    "requester_id": "M001",
    "receiver_id": "M002",
    "status": "pending"
  }
}
```
- **Kafka Event Produced:** `connection.requested`
- **Failure Cases:**
  - Duplicate connection request (409)
  - Already connected (409)
  - Cannot connect to yourself (400)
  - Missing required fields (400)

---

### Accept Connection

Accepts a pending connection request.

- **Endpoint:** `POST /api/connections/accept`
- **Request Body:**
```json
{
  "connection_id": "CON12345678"
}
```
- **Success Response (200):**
```json
{
  "success": true,
  "message": "Connection accepted successfully",
  "data": {
    "connection_id": "CON12345678",
    "requester_id": "M001",
    "receiver_id": "M002",
    "status": "accepted"
  }
}
```
- **Kafka Event Produced:** `connection.accepted`
- **Failure Cases:**
  - Connection not found (404)
  - Already accepted (409)
  - Cannot accept non-pending connection (400)

---

### Reject Connection

Rejects a pending connection request.

- **Endpoint:** `POST /api/connections/reject`
- **Request Body:**
```json
{
  "connection_id": "CON12345678"
}
```
- **Success Response (200):**
```json
{
  "success": true,
  "message": "Connection request rejected",
  "data": {
    "connection_id": "CON12345678",
    "requester_id": "M001",
    "receiver_id": "M002",
    "status": "rejected"
  }
}
```
- **Failure Cases:**
  - Connection not found (404)
  - Cannot reject non-pending connection (400)

---

### List Connections

Lists all connections for a user. Optionally filter by status.

- **Endpoint:** `POST /api/connections/list`
- **Request Body:**
```json
{
  "user_id": "M001",
  "status": "accepted"
}
```
- **Success Response (200):**
```json
{
  "success": true,
  "user_id": "M001",
  "total_connections": 3,
  "connections": [
    {
      "connection_id": "CON12345678",
      "requester_id": "M001",
      "receiver_id": "M002",
      "status": "accepted",
      "direction": "sent",
      "connected_user_id": "M002",
      "created_at": "2026-04-05T10:00:00Z",
      "updated_at": "2026-04-05T12:00:00Z"
    }
  ]
}
```
- **Failure Cases:**
  - user_id is required (400)

---

### Mutual Connections (Extra Credit)

Finds mutual connections between two users.

- **Endpoint:** `POST /api/connections/mutual`
- **Request Body:**
```json
{
  "user_id_1": "M001",
  "user_id_2": "M003"
}
```
- **Success Response (200):**
```json
{
  "success": true,
  "user_id_1": "M001",
  "user_id_2": "M003",
  "mutual_count": 2,
  "mutual_connections": ["M002", "M005"]
}
```
- **Failure Cases:**
  - Both user IDs required (400)

---

## Health Check Endpoints

| Service | Endpoint | Port |
|---------|----------|------|
| Messaging | `GET /api/messaging/health` | 3004 |
| Connection | `GET /api/connections/health` | 3005 |

---

## Kafka Event Envelope Standard

All events follow the team's shared envelope:
```json
{
  "event_type": "message.sent | connection.requested | connection.accepted",
  "trace_id": "uuid-for-tracing",
  "timestamp": "ISO-8601",
  "actor_id": "user who triggered the action",
  "entity": "thread_id or connection_id",
  "payload": { ... },
  "idempotency_key": "uuid-for-dedup"
}
```

## Failure Handling

| Scenario | Handling |
|----------|----------|
| Message send failure | Client retries with same `idempotency_key`; server deduplicates |
| Duplicate connection request | MySQL UNIQUE constraint prevents duplicates; returns 409 |
| Previously rejected request | Allows re-sending (updates existing row) |
| Kafka offline | Service continues; events logged locally for later replay |
| MongoDB duplicate key | Caught and returned as idempotent success |
