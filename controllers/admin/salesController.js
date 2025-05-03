


const Sale = require("../../models/salesSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const loadSalesPage = async (req, res) => {
    try {
        const { reportType, startDate, endDate, format } = req.query;
        let query = {};
        
        const now = new Date();

        switch (reportType) {
            case 'daily':
                const dailyStart = new Date(now.setHours(0, 0, 0, 0));
                const dailyEnd = new Date(now.setHours(23, 59, 59, 999));
                query.createdOn = { $gte: dailyStart, $lt: dailyEnd };
                break;

            case 'weekly':
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay())); 
                const weekEnd = new Date(now.setDate(now.getDate() + (6 - now.getDay()))); 
                query.createdOn = { $gte: weekStart.setHours(0, 0, 0, 0), $lt: weekEnd.setHours(23, 59, 59, 999) };
                break;

            case 'monthly':
                query.createdOn = {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1), 
                    $lt: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) 
                };
                break;

            case 'custom':
                if (startDate && endDate) {
                    query.createdOn = {
                        $gte: new Date(startDate),
                        $lt: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                    };
                }
                break;
        }

        query.status = 'Delivered'; 

        const orders = await Order.find(query)
            .populate('orderItems.product') 
            .sort({ createdOn: 1 });

        let totalRegularPrice = 0;
        let totalFinalAmount = 0;
        let totalDeliveryCharge = 0;
        const deliveryCharge = 50;

        const sales = orders.map(order => {
            const deliveredItemsAmount = order.orderItems.reduce((sum, item) => {
                if (item.status === 'Delivered') {
                    return sum + (item.price * item.quantity);
                }
                return sum;
            }, 0);

            const orderRegularPrice = order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            totalRegularPrice += orderRegularPrice;
            totalFinalAmount += deliveredItemsAmount;
            totalDeliveryCharge += order.deliveryCharge || 0;

            const couponDiscount = order.discount ? (order.totalPrice - order.finalAmount) : 0;

            return {
                orderId: order.orderId,
                amount: deliveredItemsAmount, 
                discount: order.discount || 0, 
                coupon: couponDiscount,
                deliveryCharge: deliveryCharge,
                lessPrice: totalDeliveryCharge,
                date: order.createdOn,
                items: order.orderItems.map(item => ({
                    name: item.productName || item.product.name,
                    quantity: item.quantity,
                    regularPrice: item.price,
                    finalPrice: item.status === 'Delivered' ? item.price : 0, 
                    status: item.status 
                }))
            };
        });

        const salesData = {
            shopName: 'NORD',
            reportType: reportType || 'default',
            startDate: startDate || null,
            endDate: endDate || null,
            sales,
            totalSales: totalFinalAmount,
            orderCount: sales.length,
            discounts: sales.reduce((sum, sale) => sum + sale.discount, 0),
            coupons: sales.reduce((sum, sale) => sum + sale.coupon, 0),
            deliveryCharge: deliveryCharge,
            lessPrices: totalDeliveryCharge,
        };

        if (format === 'pdf') {
            return generatePDF(res, salesData); 
        } else if (format === 'excel') {
            return generateExcel(res, salesData); 
        }

        res.render('sales-report', { salesData });
    } catch (error) {
        console.error('Error in loadSalesPage:', error);
        res.status(500).render('pageerror', { 
            message: 'Error loading sales report', 
            error: error.message 
        });
    }
};

const createSaleRecord = async (order) => {
    try {
        const sale = new Sale({
            orderId: order._id,
            amount: order.totalAmount,
            discount: order.discount || 0,
            coupon: order.couponDiscount || 0,
            date: order.orderDate || new Date()
        });
        
        await sale.save();
        return sale;
    } catch (error) {
        console.error('Error creating sale record:', error);
        throw error;
    }
};


const generatePDF = async (res, salesData) => {
    const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4'
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
    doc.pipe(res);

    const today = new Date();
    const todayFormatted = today.toLocaleDateString();
    let reportTypeHeading = '';
    let subheading = '';

    if (salesData.reportType === 'custom' && salesData.startDate && salesData.endDate) {
        const start = new Date(salesData.startDate).toLocaleDateString();
        const end = new Date(salesData.endDate).toLocaleDateString();
        reportTypeHeading = 'Custom Sales Report';
        subheading = `From ${start} to ${end}`;
    } else if (salesData.reportType === 'daily') {
        reportTypeHeading = `Daily Sales Report - ${todayFormatted}`;
    } else if (salesData.reportType === 'weekly') {
        reportTypeHeading = `Weekly Sales Report - ${todayFormatted}`;
    } else if (salesData.reportType === 'monthly') {
        const monthYear = new Date(salesData.sales[0]?.date || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        reportTypeHeading = 'Monthly Sales Report';
        subheading = monthYear;
    } else {
        reportTypeHeading = 'Sales Report';
    }

    doc.font('Helvetica-Bold')
        .fontSize(22)
        .text(`${salesData.shopName || 'Sales Report'} - ${reportTypeHeading}`, { align: 'center' });
    doc.moveDown(0.5);

    if (subheading) {
        doc.font('Helvetica')
            .fontSize(12)
            .text(subheading, { align: 'center' });
        doc.moveDown(1);
    } else {
        doc.moveDown(1);
    }

    doc.fontSize(10)
        .font('Helvetica')
        .text(`Generated on: ${todayFormatted}`, { align: 'center' });
    doc.moveDown(2);

    doc.font('Helvetica-Bold')
        .fontSize(14)
        .text("Detailed Sales");
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [80, 110, 80, 80, 80, 80]; // Adjusted for new Delivery Charge column
    const rowHeight = 25;

    doc.fillColor('#f0f0f0')
        .rect(tableLeft, tableTop, doc.page.width - 100, rowHeight)
        .fill();

    doc.fillColor('#000')
        .font('Helvetica-Bold')
        .fontSize(10);

    const headers = ["Date", "Order ID", "Amount", "Discounts", "Coupons", "Delivery Charge"];
    let xPosition = tableLeft + 10;

    headers.forEach((header, i) => {
        doc.text(header, xPosition, tableTop + 8);
        xPosition += colWidths[i];
    });

    let yPosition = tableTop + rowHeight;

    const drawTableRow = (y) => {
        doc.strokeColor('#cccccc')
            .lineWidth(0.5)
            .moveTo(tableLeft, y)
            .lineTo(tableLeft + colWidths.reduce((sum, w) => sum + w, 0), y)
            .stroke();
    };

    drawTableRow(yPosition);

    let isEvenRow = false;

    salesData.sales.forEach((sale) => {
        if (isEvenRow) {
            doc.fillColor('#f9f9f9')
                .rect(tableLeft, yPosition, doc.page.width - 100, rowHeight)
                .fill();
        }
        doc.fillColor('#000');

        xPosition = tableLeft + 10;

        doc.font('Helvetica')
            .fontSize(9);

        doc.text(new Date(sale.date).toLocaleDateString(), xPosition, yPosition + 8);
        xPosition += colWidths[0];

        const shortOrderId = sale.orderId.toString().slice(-12);
        doc.text(shortOrderId, xPosition, yPosition + 8);
        xPosition += colWidths[1];

        doc.text(`Rs. ${sale.amount.toLocaleString()}`, xPosition, yPosition + 8, {
            width: colWidths[2] - 20,
            align: 'right'
        });
        xPosition += colWidths[2];

        doc.text(`Rs. ${sale.discount.toLocaleString()}`, xPosition, yPosition + 8, {
            width: colWidths[3] - 20,
            align: 'right'
        });
        xPosition += colWidths[3];

        doc.text(`Rs. ${sale.coupon.toLocaleString()}`, xPosition, yPosition + 8, {
            width: colWidths[4] - 20,
            align: 'right'
        });
        xPosition += colWidths[4];

        doc.text(`Rs. ${sale.deliveryCharge.toLocaleString()}`, xPosition, yPosition + 8, {
            width: colWidths[5] - 20,
            align: 'right'
        });

        yPosition += rowHeight;
        drawTableRow(yPosition);
        isEvenRow = !isEvenRow;

        if (yPosition > doc.page.height - 150) {
            doc.addPage();
            yPosition = 50;
            doc.text("Detailed Sales (continued)", 50, yPosition);
            yPosition += 30;
            drawTableRow(yPosition);
        }
    });

    let vertPosition = tableLeft;
    doc.strokeColor('#cccccc').lineWidth(0.5);

    for (let i = 0; i <= colWidths.length; i++) {
        doc.moveTo(vertPosition, tableTop)
            .lineTo(vertPosition, yPosition)
            .stroke();
        vertPosition += (i < colWidths.length ? colWidths[i] : 0);
    }

    doc.moveDown(2);

    const summaryLeft = 350;
    const summaryTop = yPosition + 30;
    const summaryWidth = 200;
    const summaryHeight = 140; // Increased height to accommodate new row

    doc.roundedRect(summaryLeft, summaryTop, summaryWidth, summaryHeight, 5)
        .fillAndStroke('#f7f7f7', '#cccccc');

    doc.font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#000')
        .text("Summary", summaryLeft + 10, summaryTop + 15);

    doc.font('Helvetica')
        .fontSize(10)
        .text(`Total Sales:`, summaryLeft + 15, summaryTop + 40)
        .font('Helvetica-Bold')
        .text(`Rs. ${salesData.totalSales.toLocaleString()}`, summaryLeft + 100, summaryTop + 40);

    doc.font('Helvetica')
        .text(`Total Orders:`, summaryLeft + 15, summaryTop + 60)
        .font('Helvetica-Bold')
        .text(`${salesData.orderCount}`, summaryLeft + 100, summaryTop + 60);

    doc.font('Helvetica')
        .text(`Total Coupons:`, summaryLeft + 15, summaryTop + 80)
        .font('Helvetica-Bold')
        .text(`Rs. ${salesData.coupons.toLocaleString()}`, summaryLeft + 100, summaryTop + 80);

    doc.font('Helvetica')
        .text(`Total Discounts:`, summaryLeft + 15, summaryTop + 100)
        .font('Helvetica-Bold')
        .text(`Rs. ${salesData.discounts.toLocaleString()}`, summaryLeft + 100, summaryTop + 100);

    doc.font('Helvetica')
        .text(`Total Delivery Charge:`, summaryLeft + 15, summaryTop + 120)
        .font('Helvetica-Bold')
        .text(`Rs. ${salesData.lessPrices.toLocaleString()}`, summaryLeft + 100, summaryTop + 120);

    const pageRange = doc.bufferedPageRange();
    const pageCount = pageRange.count;

    if (pageCount > 1) {
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.font('Helvetica')
                .fontSize(8)
                .text(
                    `Page ${i + 1} of ${pageCount}`,
                    doc.page.width / 2 - 25,
                    doc.page.height - 20,
                    { align: 'center' }
                );

            doc.strokeColor('#dddddd')
                .lineWidth(0.5)
                .moveTo(50, doc.page.height - 30)
                .lineTo(doc.page.width - 50, doc.page.height - 30)
                .stroke();
        }
    }

    doc.end();
};

const generateExcel = async (res, salesData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    const today = new Date();
    const todayFormatted = today.toLocaleDateString();
    let reportTypeHeading = '';
    let subheading = '';

    if (salesData.reportType === 'custom' && salesData.startDate && salesData.endDate) {
        const start = new Date(salesData.startDate).toLocaleDateString();
        const end = new Date(salesData.endDate).toLocaleDateString();
        reportTypeHeading = 'Custom Sales Report';
        subheading = `From ${start} to ${end}`;
    } else if (salesData.reportType === 'daily') {
        reportTypeHeading = `Daily Sales Report - ${todayFormatted}`;
    } else if (salesData.reportType === 'weekly') {
        reportTypeHeading = `Weekly Sales Report - ${todayFormatted}`;
    } else if (salesData.reportType === 'monthly') {
        const monthYear = new Date(salesData.sales[0]?.date || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        reportTypeHeading = 'Monthly Sales Report';
        subheading = monthYear;
    } else {
        reportTypeHeading = 'Sales Report';
    }

    worksheet.addRow([`${salesData.shopName || 'Sales Report'} - ${reportTypeHeading}`]);
    if (subheading) {
        worksheet.addRow([subheading]);
    }
    worksheet.addRow([`Generated on: ${todayFormatted}`]);
    worksheet.addRow([]);

    worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Order ID', key: 'orderId', width: 30 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Discounts', key: 'discount', width: 15 },
        { header: 'Coupons', key: 'coupon', width: 15 },
        { header: 'Delivery Charge', key: 'deliveryCharge', width: 15 }
    ];

    worksheet.addRow(['Detailed Sales']);
    salesData.sales.forEach(sale => {
        worksheet.addRow({
            date: new Date(sale.date).toLocaleDateString(),
            orderId: sale.orderId.toString(),
            amount: `Rs. ${sale.amount.toLocaleString()}`,
            discount: `Rs. ${sale.discount.toLocaleString()}`,
            coupon: `Rs. ${sale.coupon.toLocaleString()}`,
            deliveryCharge: `Rs. ${sale.deliveryCharge.toLocaleString()}`
        });
    });

    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.addRow(['Total Sales', '', `Rs. ${salesData.totalSales.toLocaleString()}`]);
    worksheet.addRow(['Total Orders', '', salesData.orderCount]);
    worksheet.addRow(['Total Coupons', '', `Rs. ${salesData.coupons.toLocaleString()}`]);
    worksheet.addRow(['Total Discounts', '', `Rs. ${salesData.discounts.toLocaleString()}`]);
    worksheet.addRow(['Total Delivery Charge', '', `Rs. ${salesData.lessPrices.toLocaleString()}`]);
    worksheet.addRow([]);

    worksheet.getRow(1).font = { bold: true, size: 14 };
    if (subheading) {
        worksheet.getRow(2).font = { italic: true, size: 12 };
        worksheet.getRow(3).font = { size: 10 };
        worksheet.getRow(5).font = { bold: true };
        worksheet.getRow(7).font = { bold: true };
    } else {
        worksheet.getRow(2).font = { size: 10 };
        worksheet.getRow(4).font = { bold: true };
        worksheet.getRow(6).font = { bold: true };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

    await workbook.xlsx.write(res);
};

module.exports = {
    loadSalesPage,
    createSaleRecord,
    generatePDF,
    generateExcel
};