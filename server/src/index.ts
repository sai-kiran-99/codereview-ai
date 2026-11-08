import "dotenv/config";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 4000;

const app = createApp();

// TODO (your task): connect to MongoDB via ./db.ts before listening.
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
