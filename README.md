# Redis-like Server

This project implements a simple Redis-like server in TypeScript. It provides basic functionalities similar to Redis, such as key-value storage, commands handling, and memory management.

## Getting Started

### Prerequisites

- Node.js installed on your machine

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd redis-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

Instantiate the `RedisServer` class with a port and host:

```typescript
import { RedisServer } from "./server";

// Example usage
new RedisServer(6379, "localhost");
```
Use redis-cli to connect redis-server

```bash
redis-cli -h localhost -p 6379
```

## Supported Commands

- **PING**: Responds with "PONG".
- **ECHO**: Returns the input string.
- **SET**: Sets a key with a value.
- **GET**: Retrieves the value associated with a key.
- **EXISTS**: Checks if a key exists.
- **DEL**: Deletes one or more keys.
- **LPUSH**: Pushes elements to the head of a list.
- **RPUSH**: Pushes elements to the tail of a list.
- **INCR**: Increments the value of a key.
- **DECR**: Decrements the value of a key.
- **SAVE**: Saves the current state to storage.

## Contributing

Contributions are welcome! If you find any issues or want to add new features, please submit a pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
