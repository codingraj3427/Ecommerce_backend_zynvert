const { sequelize } = require("../config/db.postgres");
const { Invoice } = require("../models/postgres/index");
const { Op } = require("sequelize");
const { generateNextInvoiceNumber } = require("../utils/invoiceHelper");

// 1. Get All Invoices (Unified List)
exports.getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.findAll({
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// 2. Generate Manual Bill (POS / Walk-in)
exports.createManualInvoice = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { customer, items, shipping_fee = 0, discount_amount = 0 } = req.body;

    const placeOfSupply = customer?.state || "West Bengal";
    const isInterState = !String(placeOfSupply)
      .toLowerCase()
      .includes("west bengal");

    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let itemsTotal = 0;

    const processedItems = items.map((item) => {
      const qty = Number(item.qty);
      const priceExclTax = Number(item.unit_price);
      const gstRate = Number(item.gst_rate);

      const itemTaxable = priceExclTax * qty;
      const itemGstAmount = itemTaxable * (gstRate / 100);

      let cgstAmt = 0;
      let sgstAmt = 0;
      let igstAmt = 0;

      if (isInterState) {
        igstAmt = itemGstAmount;
        totalIGST += igstAmt;
      } else {
        cgstAmt = itemGstAmount / 2;
        sgstAmt = itemGstAmount / 2;
        totalCGST += cgstAmt;
        totalSGST += sgstAmt;
      }

      totalTaxableValue += itemTaxable;
      itemsTotal += itemTaxable + itemGstAmount;

      return {
        name: item.name,
        sku: item.sku || "N/A",
        hsn: item.hsn || "N/A",
        qty: qty,
        unit_price: priceExclTax.toFixed(2),
        gst_rate: gstRate,
        taxable: itemTaxable.toFixed(2),
        cgst: cgstAmt.toFixed(2),
        sgst: sgstAmt.toFixed(2),
        igst: igstAmt.toFixed(2),
        total: (itemTaxable + itemGstAmount).toFixed(2),
      };
    });

    const shipTaxable = Number(shipping_fee) / 1.18;
    const shipGst = shipTaxable * 0.18;
    totalTaxableValue += shipTaxable;

    if (isInterState) {
      totalIGST += shipGst;
    } else {
      totalCGST += shipGst / 2;
      totalSGST += shipGst / 2;
    }

    const grandTotal =
      itemsTotal + Number(shipping_fee) - Number(discount_amount);
    const invoiceNumber = await generateNextInvoiceNumber(t);

    const newInvoice = await Invoice.create(
      {
        invoice_number: invoiceNumber,
        invoice_type: customer?.gstin ? "B2B_MANUAL" : "MANUAL", // ✅ Flags as B2B if GSTIN is present
        customer_name: customer?.name || "Walk-in Customer",
        company_name: customer?.company_name || null, // ✅ Save Company
        customer_gstin: customer?.gstin?.toUpperCase() || null, // ✅ Save GSTIN
        customer_phone: customer?.phone || "",
        billing_address: customer?.address || "",
        place_of_supply: placeOfSupply,
        total_taxable_value: totalTaxableValue.toFixed(2),
        total_cgst: totalCGST.toFixed(2),
        total_sgst: totalSGST.toFixed(2),
        total_igst: totalIGST.toFixed(2),
        shipping_fee: shipping_fee,
        discount_amount: discount_amount,
        grand_total: Math.round(grandTotal).toFixed(2),
        items: processedItems,
      },
      { transaction: t },
    );

    await t.commit();
    res.status(201).json({ message: "Invoice Generated", invoice: newInvoice });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};
