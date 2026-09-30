import { request } from 'node:http';
import { config } from './config.ts';

// Sends one request to the Docker Engine API over the socket
function callDockerApi(method: string, path: string, bodyToSend?: unknown) {
  return new Promise((resolve, reject) => {
    const requestBody = bodyToSend ? JSON.stringify(bodyToSend) : undefined;

    const options = {
      socketPath: config.DOCKER_SOCKET_PATH,
      path,
      method,
      headers: requestBody
        ? {
            Host: 'localhost',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
          }
        : { Host: 'localhost' },
    };

    const req = request(options, (res) => {
      let responseText = '';
      res.on('data', (chunk) => {
        responseText += chunk;
      });
      res.on('end', () => {
        const failed = (res.statusCode ?? 500) >= 400;
        if (failed) {
          reject(
            new Error(
              `Docker API ${method} ${path} failed with status ${res.statusCode}: ${responseText}`,
            ),
          );
          return;
        }
        resolve(responseText ? JSON.parse(responseText) : null);
      });
    });

    req.on('error', reject);
    if (requestBody) req.write(requestBody);
    req.end();
  });
}

// Swarm always puts the stack name in front of a service's name,
// e.g. the "thumbnail-worker" service becomes "dam-platform_thumbnail-worker"
export function fullServiceName(shortName: string) {
  return `${config.STACK_NAME}_${shortName}`;
}

// Looks up everything Docker knows about a service right now:
export async function getService(shortName: string) {
  const name = fullServiceName(shortName);
  const service = await callDockerApi('GET', `/services/${name}`);
  return service as {
    ID: string;
    Version: { Index: number };
    Spec: { Mode: { Replicated: { Replicas: number } } };
  };
}

// Tells Docker to run a different number of copies of a service.
export async function scaleService(shortName: string, newReplicaCount: number) {
  // Docker requires you to send back everything about the service
  const service = await getService(shortName);
  service.Spec.Mode.Replicated.Replicas = newReplicaCount;

  await callDockerApi(
    'POST',
    `/services/${service.ID}/update?version=${service.Version.Index}`,
    service.Spec,
  );
}
