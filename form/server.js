const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 8030;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname, query } = parsedUrl;

      // Handle proxy headers for Server Actions
      if (req.headers['x-forwarded-host'] && req.headers['x-forwarded-host'] !== 'form.owner-inspections.com.au') {
        req.headers['x-forwarded-host'] = 'form.owner-inspections.com.au';
      }
      
      if (req.headers['host'] && req.headers['host'] !== 'form.owner-inspections.com.au') {
        req.headers['host'] = 'form.owner-inspections.com.au';
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
