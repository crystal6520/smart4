const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("feed", { title: "Feed Page" });
});

module.exports = router;