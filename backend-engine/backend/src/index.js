import "dotenv/config"
import { app } from "./app.js";

const PORT = process.env.PORT || 8080;

// app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
app.listen(PORT, '0.0.0.0', () => console.log('up on', PORT));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});