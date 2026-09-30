import { readFileSync } from 'node:fs';
import { Router } from 'express';

// Read once when the API starts, so a missing file stops the start instead of giving a blank page
const spec = readFileSync(
  new URL('../../../docs/openapi.yaml', import.meta.url),
  'utf8',
);

// The spec link has no leading slash, so it still works behind nginx, where the page lives under /api
const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DAM API docs</title>
  </head>
  <body>
    <redoc spec-url="openapi.yaml"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js"></script>
  </body>
</html>
`;

export function docsRoutes() {
  const router = Router();

  router.get('/', (req, res) => {
    if (!req.originalUrl.split('?')[0]!.endsWith('/')) {
      return res.redirect('docs/');
    }
    res.type('html').send(page);
  });

  router.get('/openapi.yaml', (_req, res) => {
    res.type('application/yaml').send(spec);
  });

  return router;
}
