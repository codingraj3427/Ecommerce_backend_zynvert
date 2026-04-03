const { Op } = require("sequelize");
const { Invoice } = require("../models/postgres/index");

exports.generateNextInvoiceNumber = async (transaction) => {
  const currentYear = new Date().getFullYear();
  const prefix = `ZYN/${currentYear}/`;

  const lastInvoice = await Invoice.findOne({
    where: { invoice_number: { [Op.like]: `${prefix}%` } },
    order: [["createdAt", "DESC"]],
    transaction,
  });

  let nextSequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoice_number.split("/").pop(), 10);
    nextSequence = lastSequence + 1;
  }

  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
};