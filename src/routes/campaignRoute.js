const express = require("express");
const router = express.Router();
const campaignController = require("../controllers/campaignController");

router.post("/send-email", campaignController.sendEmailCampaign);
router.get(
  "/customers",
  campaignController.getCustomersForCampaign
);

module.exports = router;
