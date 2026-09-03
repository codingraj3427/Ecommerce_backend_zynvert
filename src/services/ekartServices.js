const axios = require("axios");

// Calculate estimated delivery days
function calculateEstimatedDays(destinationPincode) {
  const zoneCode = parseInt(destinationPincode.substring(0, 2), 10);

  // West Bengal
  if (zoneCode >= 70 && zoneCode <= 74) {
    if (
      destinationPincode.startsWith("700") ||
      destinationPincode.startsWith("743")
    ) {
      return 1;
    }
    return 3;
  }

  // Eastern India
  if (zoneCode >= 75 && zoneCode <= 85) {
    return 4;
  }

  // Major Metros
  if ([11, 12, 40, 60].includes(zoneCode)) {
    return 5;
  }

  // Remote Areas
  if ([18, 19, 79].includes(zoneCode)) {
    return 9;
  }

  return 7;
}

async function checkServiceability(pincode, weight = 0.5) {
  try {
    const estimatedDays = calculateEstimatedDays(pincode);

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + estimatedDays);

    // Skip Sunday
    if (deliveryDate.getDay() === 0) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
    }

    const formattedDate = deliveryDate.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    let district = "";
    let state = "";

    try {
      const postalResponse = await axios.get(
        `https://api.postalpincode.in/pincode/${pincode}`,
        {
          timeout: 1000, // Reduced from 5000ms
        },
      );

      const postalData = postalResponse.data;

      if (
        postalData?.[0]?.Status === "Success" &&
        postalData?.[0]?.PostOffice?.length
      ) {
        const postOffice = postalData[0].PostOffice[0];

        district =
          postOffice.District || postOffice.Block || postOffice.Region || "";

        state = postOffice.State || "";
      }
    } catch (postalError) {
      console.log(
        `Postal lookup skipped for ${pincode}: ${postalError.message}`,
      );
    }

    return {
      success: true,
      estimatedDays,
      estimatedDate: formattedDate,
      courier: "Ekart Surface",
      district,
      state,
    };
  } catch (error) {
    console.error("Serviceability Error:", error.message);

    return {
      success: false,
      estimatedDays: null,
      estimatedDate: null,
      courier: null,
      district: "",
      state: "",
    };
  }
}

module.exports = {
  checkServiceability,
};
