import express from "express";
const router = express.Router();

// Example API route
router.get("/users", (req, res) => {
  res.json([
    { id: 1, name: "Alice", age: 25 },
    { id: 2, name: "Bob", age: 30 },
    { id: 3, name: "Charlie", age: 28 }
  ]);
});

router.get("/server-info", (req, res) => {
  res.json({
    title: "Server Info Page",
    message: "This is a hybrid page served by Express but rendered in SPA.",
    timestamp: new Date().toLocaleString()
  });
});

export default router;
