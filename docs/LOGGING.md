# Logging Configuration

This project uses **LogLayer** with **Pino** and **Pino-pretty** for structured, colorful logging in the backend.

## Stack

- **LogLayer**: A unified TypeScript logger that provides a consistent API across different logging libraries
- **Pino**: A high-performance Node.js logger with minimal overhead
- **Pino-pretty**: Pretty printer for Pino logs with colorized output for development
- **@loglayer/transport-pino**: LogLayer transport for Pino integration

## Configuration

The logger is configured in [src/backend/logger.ts](../src/backend/logger.ts) and exports a LogLayer instance directly.

## Usage

### Basic Logging

```typescript
import { logger } from './logger';

// Simple messages
logger.info('Server started successfully');
logger.debug('Making API request');
logger.warn('Deprecated endpoint used');
logger.error('Failed to connect');
```

### Logging with Metadata

Use `.withMetadata()` to add structured data to your logs:

```typescript
import { logger } from './logger';

logger
  .withMetadata({
    method: 'POST',
    path: '/api/mode',
    duration: 45,
    status: 200,
  })
  .info('API request completed');
```

### Logging Errors

Use `.withError()` to properly log Error objects:

```typescript
import { logger } from './logger';

try {
  await someOperation();
} catch (error) {
  logger.withError(error as Error).error('Operation failed');
}
```

### Combining Metadata and Errors

You can chain multiple methods:

```typescript
logger
  .withError(error as Error)
  .withMetadata({ deviceId: 'twinkly-1' })
  .error('Failed to fetch device status');
```

## Log Levels

Set the `LOG_LEVEL` environment variable to control verbosity:

- `trace` - Most verbose (includes all below)
- `debug` - Debug information
- `info` - General information (default)
- `warn` - Warning messages
- `error` - Error messages
- `fatal` - Fatal errors

### Examples

```bash
# Run with debug logging
LOG_LEVEL=debug npm run dev:server

# Run with minimal logging (errors only)
LOG_LEVEL=error npm run dev:server
```

## Features

### 🎨 Colorful Console Output

Pino-pretty provides colorized, human-readable logs in the terminal during development:

```
[18:40:48 UTC] INFO: Backend server running on http://localhost:3001
[18:40:52 UTC] DEBUG: Fetching device status
```

### 📊 Structured Logging

All logs support metadata as objects, which are properly serialized and can be easily searched in log aggregation tools.

### 🔒 Type Safety

LogLayer is fully typed with TypeScript, providing autocomplete and type checking for all logging operations.

### ⚡ Performance

Pino is one of the fastest Node.js loggers available, with minimal overhead even at high volumes.

## Migration from console.log

All `console.log` and `console.error` calls in the backend have been replaced with LogLayer:

- `console.log(message)` → `logger.info(message)`
- `console.log(message, data)` → `logger.withMetadata(data).info(message)`
- `console.error(message, error)` → `logger.withError(error).error(message)`
- Debug logs → `logger.debug(message)` or `logger.withMetadata({...}).debug(message)`

## Future Enhancements

With LogLayer, we can easily add:

- **File logging** for production environments
- **Cloud logging** (AWS CloudWatch, Datadog, New Relic, etc.)
- **OpenTelemetry integration** for distributed tracing
- **Log rotation** for file-based logging
- **Multiple transports** simultaneously (e.g., console + file + cloud)

Just add the appropriate LogLayer transport without changing any logging code throughout the application.

## Benefits

1. **Structured**: Logs are structured with metadata, making them easier to search and analyze
2. **Consistent**: All backend logs use the same LogLayer API
3. **Colorful**: Development logs are colorized for better readability
4. **Flexible**: Easy to add new transports (file, cloud services) without code changes
5. **Performant**: Pino is one of the fastest Node.js loggers available
6. **Type-safe**: Full TypeScript support with proper type definitions
7. **Error handling**: Proper error serialization with `.withError()` method
8. **Future-proof**: LogLayer provides abstraction over the underlying logging library
