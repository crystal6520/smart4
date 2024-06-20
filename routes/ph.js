const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("ph", { title: "ph Page" });
});

module.exports = router;