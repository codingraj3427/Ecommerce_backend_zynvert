// controllers/batteryEstimator.controller.js

exports.calculateBatteryCost = (req, res) => {
  try {
    const { batteryType, cellType, voltage, capacityAh } = req.body;

    // Nominal voltages
    const cellVoltages = {
      "18650": 3.7,
      "32700": 3.2,
      "32140": 3.2
    };

    // Cell capacities (example values, replace with real)
    const cellCapacityAh = {
      "18650": 2.6,
      "32700": 6,
      "32140": 12
    };

    // Cell prices (edit these)
    const cellPrices = {
      "18650": 120,
      "32700": 180,
      "32140": 280
    };

    const cellVoltage = cellVoltages[cellType];
    const cellAh = cellCapacityAh[cellType];
    const cellPrice = cellPrices[cellType];

    // Series and parallel
    const series = Math.round(voltage / cellVoltage);
    const parallel = Math.ceil(capacityAh / cellAh);

    const totalCells = series * parallel;
    const totalCost = totalCells * cellPrice;

    res.json({
      series,
      parallel,
      totalCells,
      totalCost,
      cellType,
      batteryType,
      voltage,
      capacityAh
    });
  } catch (err) {
    res.status(500).json({ error: "Battery cost calculation failed" });
  }
};
