import { createServer } from 'node:http';
import handler from './handler.mjs';
const port = Number(process.env.API_PORT || 4501);
createServer(handler).listen(port, () => console.log(`Assistant API listening on http://localhost:${port}`));
