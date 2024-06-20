const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("water", { title: "Water Supply Page" });
});

module.exports = router;