import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on ${env.APP_BASE_URL} (port ${env.PORT})`);
});
