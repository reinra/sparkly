import type { Request, Response, NextFunction, Express } from 'express';
import { z } from 'zod';
import { logger, logError } from './logger';
import { DeviceUnreachableError } from './deviceClient/ApiClient';
import { DeviceNotFoundError, DeviceOfflineError, EffectNotFoundError } from './DeviceService';

interface EndpointDefinition {
  method?: string;
  path?: string;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  responses: {
    [statusCode: number]: z.ZodTypeAny;
  };
}

type InferBody<T extends EndpointDefinition> = T['body'] extends z.ZodTypeAny ? z.infer<T['body']> : never;

type InferQuery<T extends EndpointDefinition> = T['query'] extends z.ZodTypeAny
  ? z.infer<T['query']>
  : Request['query'];

type InferResponse<
  T extends EndpointDefinition,
  Status extends keyof T['responses'],
> = T['responses'][Status] extends z.ZodTypeAny ? z.infer<T['responses'][Status]> : never;

type TypedRequest<T extends EndpointDefinition> = Omit<Request, 'body' | 'query'> & {
  body: InferBody<T>;
  query: InferQuery<T>;
};

interface TypedResponse<T extends EndpointDefinition> extends Response {
  json<Status extends keyof T['responses'] & number>(this: TypedResponse<T>, body: InferResponse<T, Status>): this;
  status(code: number): this;
}

export type TypedHandler<T extends EndpointDefinition> = (
  req: TypedRequest<T>,
  res: TypedResponse<T>
) => Promise<void> | void;

export type TypedHandlers<T extends Record<string, EndpointDefinition>> = {
  [K in keyof T]: TypedHandler<T[K]>;
};

/**
 * Creates a type-safe Express handler that validates request body and response against Zod schemas
 */
export function createTypedHandler<T extends EndpointDefinition>(endpoint: T, handler: TypedHandler<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate query params if schema exists
      let parsedQuery = req.query;
      if (endpoint.query) {
        try {
          parsedQuery = endpoint.query.parse(req.query);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResponse = endpoint.responses[500]?.parse({
              error: 'Invalid query parameters: ' + error.errors.map((e) => e.message).join(', '),
            });
            return res.status(400).json(errorResponse);
          }
          throw error;
        }
      }

      // Validate request body if schema exists
      if (endpoint.body && req.method !== 'GET') {
        try {
          req.body = endpoint.body.parse(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResponse = endpoint.responses[500]?.parse({
              error: 'Invalid request: ' + error.errors.map((e) => e.message).join(', '),
            });
            return res.status(400).json(errorResponse);
          }
          throw error;
        }
      }

      // Wrap res.json to validate responses
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        const statusCode = res.statusCode || 200;
        const schema = endpoint.responses[statusCode];
        if (schema) {
          try {
            body = schema.parse(body);
          } catch (error) {
            if (error instanceof z.ZodError) {
              logError(error).error('Response validation error');
            }
          }
        }
        return originalJson(body);
      };

      const typedReq = Object.create(req, {
        query: { value: parsedQuery, writable: true },
      }) as TypedRequest<T>;

      await handler(typedReq, res as TypedResponse<T>);
    } catch (error) {
      // Client errors (404, 400) are expected and logged at WARN level;
      // only true server errors are logged at ERROR level.
      if (error instanceof z.ZodError) {
        logger.warn('Handler validation error: ' + error.errors.map((e) => e.message).join(', '));
        const errorResponse = endpoint.responses[500].parse({
          error: 'Invalid request: ' + error.errors.map((e) => e.message).join(', '),
        });
        return res.status(400).json(errorResponse);
      } else if (error instanceof DeviceNotFoundError || error instanceof EffectNotFoundError) {
        logger.warn(error.message);
        const errorResponse = endpoint.responses[500]?.parse({
          error: error.message,
        });
        return res.status(404).json(errorResponse);
      } else if (error instanceof DeviceUnreachableError || error instanceof DeviceOfflineError) {
        logger.warn(error.message);
        const errorResponse = endpoint.responses[500]?.parse({
          error: error.message,
        });
        return res.status(503).json(errorResponse);
      } else {
        logError(error).error('Handler error');
        const errorResponse = endpoint.responses[500]?.parse({
          error: 'Internal server error',
        });
        return res.status(500).json(errorResponse);
      }
    }
  };
}

/**
 * Register a route using path and method from the API contract
 */
export function registerRoute<T extends EndpointDefinition>(app: Express, endpoint: T, handler: TypedHandler<T>) {
  if (!endpoint.path || !endpoint.method) {
    throw new Error('Endpoint must have path and method defined');
  }

  const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
  app[method](endpoint.path, createTypedHandler(endpoint, handler));
}

/**
 * Register all routes from an API contract
 */
export function registerRoutes<T extends Record<string, EndpointDefinition>>(
  app: Express,
  contract: T,
  handlers: {
    [K in keyof T]: TypedHandler<T[K]>;
  }
) {
  for (const [key, endpoint] of Object.entries(contract)) {
    const handler = handlers[key as keyof T];
    if (!handler) {
      throw new Error(`No handler provided for endpoint: ${key}`);
    }
    registerRoute(app, endpoint as T[keyof T], handler as TypedHandler<T[keyof T]>);
  }
}
