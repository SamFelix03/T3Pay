import { createApp } from "./app";

createApp()
  .then((app) => {
    app.server.listen(app.env.port, app.env.host, () => {
      console.log(`VaultPay API listening on http://${app.env.host}:${app.env.port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
