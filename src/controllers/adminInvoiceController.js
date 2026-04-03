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

    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let itemsTotal = 0;

    const processedItems = items.map(item => {
      const qty = Number(item.qty);
      const priceExclTax = Number(item.unit_price); 
      const gstRate = Number(item.gst_rate);
      
      const itemTaxable = priceExclTax * qty;
      const itemGstAmount = itemTaxable * (gstRate / 100);
      
      totalTaxableValue += itemTaxable;
      totalCGST += itemGstAmount / 2;
      totalSGST += itemGstAmount / 2;
      itemsTotal += (itemTaxable + itemGstAmount);

      return {
        name: item.name,
        sku: item.sku || "N/A",
        hsn: item.hsn || "N/A",
        qty: qty,
        unit_price: priceExclTax.toFixed(2),
        gst_rate: gstRate,
        taxable: itemTaxable.toFixed(2),
        cgst: (itemGstAmount / 2).toFixed(2),
        sgst: (itemGstAmount / 2).toFixed(2),
        total: (itemTaxable + itemGstAmount).toFixed(2)
      };
    });

    // Add Shipping Tax
    const shipTaxable = Number(shipping_fee) / 1.18;
    const shipGst = shipTaxable * 0.18;
    totalTaxableValue += shipTaxable;
    totalCGST += shipGst / 2;
    totalSGST += shipGst / 2;

    const grandTotal = itemsTotal + Number(shipping_fee) - Number(discount_amount);
    const invoiceNumber = await generateNextInvoiceNumber(t);

    const newInvoice = await Invoice.create({
      invoice_number: invoiceNumber,
      invoice_type: "MANUAL",
      customer_name: customer.name || "Walk-in Customer",
      customer_phone: customer.phone || "",
      billing_address: customer.address || "",
      place_of_supply: customer.state || "West Bengal",
      total_taxable_value: totalTaxableValue.toFixed(2),
      total_cgst: totalCGST.toFixed(2),
      total_sgst: totalSGST.toFixed(2),
      shipping_fee: shipping_fee,
      discount_amount: discount_amount,
      grand_total: Math.round(grandTotal).toFixed(2),
      items: processedItems
    }, { transaction: t });

    await t.commit();
    res.status(201).json({ message: "Invoice Generated", invoice: newInvoice });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
};