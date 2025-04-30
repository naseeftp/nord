const User=require("../../models/userSchema");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Cart = require('../../models/cartSchema')
const Address = require('../../models/addressSchema')
const  Order=require("../../models/orderSchema")
const Wallet=require('../../models/walletSchema')
const { v4: uuidv4 } = require('uuid');
require('dotenv').config()
const mongoose = require("mongoose");
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Transaction=require('../../models/transactionSchema')

const Razorpay=require('razorpay');
const razorpay=new Razorpay({
    key_id:process.env.RAZORPAY_API_KEY,
    key_secret: process.env.RAZORPAY_API_SECRET
})

const DELIVERY_CHARGE =50;

const createOrder = async (req, res) => {
    const { amount, currency } = req.body
    try {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, error: "Invalid amount" })
        }
        
        const options = {
            amount: Math.round(Number(amount) * 100), 
            currency: currency || "INR",
            payment_capture: 1,//payment capture automattically
        }
        
        const order = await razorpay.orders.create(options)
        res.json({ success: true, order })
    } catch (error) {
        console.log('Error while adding the UPI payment: ', error)
        res.status(500).json({ success: false, error: error.message })
    }
}

const orderConfirm = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }
        const user = await User.findById(userId);
        const order = await Order.findOne({ userId })
            .sort({ createdOn: -1 })
            .limit(1)
            .populate('orderItems.product')
            .populate('address')
            .lean();

      

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
    res.render('order', {
            user,
            order: order || null,
            orderId: order?.orderId || 'N/A',
        });
    } catch (error) {
        console.error('Error in order confirmation:', error);
        res.redirect('/pageNotFound');
    }
};

const placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;
    
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Address ID is required" });
        }
       
        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(404).json({ success: false, message: "User address not found" });
        }

        const selectedAddress = userAddress.address.id(addressId)
    
        if (!selectedAddress) {
            return res.status(404).json({ success: false, message: "Selected address not found" });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }
      
        let stockError = null;
        for (const item of cart.items) {
            const product = item.productId;
            const sizeData = product.sizes.find(size => size.size === item.selectedSize);

            if (!sizeData || sizeData.quantity < item.quantity) {
                stockError = `Sorry, only ${sizeData?.quantity || 0} units of ${product.productName} (size: ${item.selectedSize}) are available.`;
                break;
            }
        }

        if (stockError) {
            return res.status(400).json({ success: false, message: stockError });
        }

          
        const blockedProducts = cart.items.filter(item => item.productId.isBlocked);

        if (blockedProducts.length > 0) {
            return res.status(403).json({
                success: false,
                message: `The product "${blockedProducts[0].productId.productName}" has been blocked by the admin. Please remove it from the cart before placing the order.`,
            });
        }

        let totalPrice = 0;
        cart.items.forEach(item => {
            const itemTotalPrice = item.price * item.quantity;
            totalPrice += itemTotalPrice; 
        });

        const orderItems = cart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            selectedSize:item.selectedSize
        }));
        const discount = req.session.offerPrice || 0
        const deliveryCharge=DELIVERY_CHARGE
        const finalAmount = (totalPrice - discount)+deliveryCharge
         
      

        const newOrder = new Order({
            userId,
            orderItems,
            totalPrice,
            discount, 
            deliveryCharge,
            finalAmount, 
            address: selectedAddress, 
            status: 'Pending',
            invoiceDate: new Date(),
            couponApplied: false,
            paymentMethod,
        });
        await newOrder.save();
       
        if(paymentMethod==='wallet'){
            const wallet =await Wallet.findOne({userId});
            if(!wallet||wallet.balance<finalAmount){
               return res.status(400).json({
                 success:false,
                 message:`insufficiant  balance required :₹${finalAmount}`
   
               })
            }
   
            wallet.balance-=finalAmount;
            wallet.totalDebited+=finalAmount;
            wallet.transactions.push({
              transactionId:uuidv4(),
              amount:finalAmount,
              transactionType:'debit',
              transactionPurpose:'purchase',
              description:`order payment :${newOrder._id}`,
              createdAt:new Date()
           });
           await wallet.save();
   
           await Transaction.create({
               userId,
               amount:finalAmount,
               transactionType:'debit',
               paymentMethod:'wallet',
               status:'completed',
               purpose:'purchase',
               description:`payment for  order ${newOrder._id}`,
               walletBalanceAfter:wallet.balance,
               orders:[{
                   orderId:newOrder._id.toString(),
                   amount:finalAmount
               }]
   
           })
   
          }
   


        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (product) {
                product.sizes = product.sizes.map(size => {
                    if (size.size === item.selectedSize) {
                        size.quantity = Math.max(0, size.quantity - item.quantity);
                    }
                    return size;
                });
                await product.save();
            }
        }

      req.session.offerPrice = null
        await Cart.findOneAndUpdate({ userId }, { items: [] });

        res.status(201).json({ success: true, message: "Order placed successfully", order: newOrder });

    } catch (error) {
        console.error("Error while placing the order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).send("User not authenticated.");
        }

       
        const order = await Order.findById(req.query.id) 
            .populate({
                path: "orderItems.product",
                select: "productName productImage"
            })
            .populate({
                path: "address", 
                select: "addressType name city landMark state pincode phone altPhone"
            })
            .lean();

            console.log("orderdetail",order)
        if (!order) {
            return res.status(404).send("Order not found");
        }

const selectedAddress = order.address;
const deliveryCharge=order.deliveryCharge||0

res.render("orderDetails", { orders: order,
     address: selectedAddress,
     deliveryCharge,
     discount: order.couponApplied ? order.totalPrice - order.finalAmount : 0
    
    
    });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Server error");
    }
};



// const cancelOrder = async (req, res) => {
//     try {
//         let { orderId, productId, size } = req.body;
//         console.log('Request body:', req.body);

       
//         orderId = orderId?.trim();
//         productId = productId?.trim();
//         size = size?.trim();

//         if (!orderId || !productId || !size) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: "Missing required fields" 
//             });
//         }

     
//         const order = await Order.findOne({ _id: orderId });
//         if (!order) {
//             return res.status(404).json({ 
//                 success: false, 
//                 message: "Order not found" 
//             });
//         }

    
//         const itemToCancel = order.orderItems.find(item => 
//             (item._id.toString() === productId || 
//              item.product.toString() === productId) &&
//             item.selectedSize.trim().toLowerCase() === size.trim().toLowerCase()
//         );

//         if (!itemToCancel) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Item not found in the order",
//                 debug: {
//                     received: { productId, size },
//                     availableItems: order.orderItems.map(item => ({
//                         itemId: item._id.toString(),
//                         productId: item.product.toString(),
//                         size: item.selectedSize
//                     }))
//                 }
//             });
//         }

//         if (itemToCancel.status === 'Cancelled') {
//             return res.status(400).json({
//                 success: false,
//                 message: "Item is already cancelled"
//             });
//         }

//         const itemPrice = itemToCancel.price * itemToCancel.quantity;
        
//           const remainingItems=order.orderItems.filter(item=>
//           item.status!=='Cancelled'&&
//           item._id.toString()!==itemToCancel._id.toString()


//         )
        
//         let refundAmount=itemPrice;
//         if(remainingItems.length===0){
//             refundAmount+=order.deliveryCharge;
//             order.deliveryCharge=0;
//         }
       
//         const product = await Product.findById(itemToCancel.product);
//         if (product) {
//             const sizeIndex = product.sizes.findIndex(s => 
//                 s.size.toLowerCase() === size.toLowerCase()
//             );
//             if (sizeIndex !== -1) {
//                 product.sizes[sizeIndex].quantity += itemToCancel.quantity;
//                 await product.save();
//             }
//         }
      

//         order.totalPrice -= itemPrice;
//         order.finalAmount -= refundAmount;
//         itemToCancel.status='Cancelled';
        
//         const allItemsCancelled=order.orderItems.every(item=>item.status==='Cancelled')
//         if(allItemsCancelled){
//             order.status='Cancelled';
//         }
//         else{
//             order.status="Pending"
//         }

//       await order.save();

//         if (order.paymentMethod !== 'COD') {
           
//             let wallet = await Wallet.findOne({ userId: order.userId });
            
//             if (!wallet) {
//                 wallet = new Wallet({
//                     userId: order.userId,
//                     balance: 0,
//                     refundAmount: 0,
//                     totalDebited: 0,
//                     transactions: []
//                 });
//             }

      
//             wallet.balance += refundAmount;
//             wallet.refundAmount +=refundAmount ;

         
//             wallet.transactions.push({
//                 transactionId: uuidv4(),
//                 amount: refundAmount,
//                 transactionType: 'credit',
//                 transactionPurpose: 'refund',
//                 description: `Refund for cancelling item: ${itemToCancel.productName}, size: ${itemToCancel.selectedSize}`,
//                 createdAt: new Date()
//             });

//             await wallet.save();

           
//             await Transaction.create({
//                 userId: order.userId,
//                 amount: refundAmount,
//                 transactionType: "credit",
//                 paymentMethod: "wallet",
//                 paymentGateway: "wallet",
//                 status: "completed",
//                 purpose: "cancellation_order_refund",
//                 description:  remainingItems.length > 0  ? "Partial refund for canceled order item"  : "Full order cancellation refund including delivery charge",
//                 walletBalanceAfter: wallet.balance,
//                 orders: [{ 
//                     orderId: order._id.toString(), 
//                     amount: refundAmount
//                 }]
//             });
//         }

  
//         await Order.updateOne(
//             { _id: orderId, "orderItems._id": itemToCancel._id },
//             { $set: { "orderItems.$.status": "Cancelled" } }
//         );

//         res.json({ 
//             success: true, 
//             message: "Item cancelled successfully",
//             paymentMethod: order.paymentMethod,
//             refundAmount:refundAmount,
//             isFullCancellation: remainingItems.length === 0
            
//         });

//     } catch (error) {
//         console.error("Error cancelling order:", error);
//         res.status(500).json({ 
//             success: false, 
//             message: error.message || "Server error",
//             error: error.stack 
//         });
//     }
// };





const cancelOrder = async (req, res) => {
    try {
        let { orderId, productId, size } = req.body;
        console.log('Request body:', req.body);

        orderId = orderId?.trim();
        productId = productId?.trim();
        size = size?.trim();

        if (!orderId || !productId || !size) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required fields" 
            });
        }

        const order = await Order.findOne({ _id: orderId });
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        const itemToCancel = order.orderItems.find(item => 
            (item._id.toString() === productId || 
             item.product.toString() === productId) &&
            item.selectedSize.trim().toLowerCase() === size.trim().toLowerCase()
        );

        if (!itemToCancel) {
            return res.status(400).json({
                success: false,
                message: "Item not found in the order",
                debug: {
                    received: { productId, size },
                    availableItems: order.orderItems.map(item => ({
                        itemId: item._id.toString(),
                        productId: item.product.toString(),
                        size: item.selectedSize
                    }))
                }
            });
        }

        if (itemToCancel.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: "Item is already cancelled"
            });
        }

        const itemPrice = itemToCancel.price * itemToCancel.quantity;

        const remainingItems = order.orderItems.filter(item =>
            item.status !== 'Cancelled' &&
            item._id.toString() !== itemToCancel._id.toString()
        );

        let refundAmount = itemPrice;
        if (remainingItems.length === 0) {
            refundAmount += order.deliveryCharge;
            order.deliveryCharge = 0;
        }

        const product = await Product.findById(itemToCancel.product);
        if (product) {
            const sizeIndex = product.sizes.findIndex(s =>
                s.size.toLowerCase() === size.toLowerCase()
            );
            if (sizeIndex !== -1) {
                product.sizes[sizeIndex].quantity += itemToCancel.quantity;
                await product.save();
            }
        }

        order.totalPrice -= itemPrice;
        order.finalAmount -= refundAmount;
        itemToCancel.status = 'Cancelled';

        const allItemsCancelled = order.orderItems.every(item => item.status === 'Cancelled');
        order.status = allItemsCancelled ? 'Cancelled' : 'Pending';

        await order.save();

  
        if (order.paymentMethod !== 'cod') {
            let wallet = await Wallet.findOne({ userId: order.userId });

            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    refundAmount: 0,
                    totalDebited: 0,
                    transactions: []
                });
            }

            wallet.balance += refundAmount;
            wallet.refundAmount += refundAmount;

            wallet.transactions.push({
                transactionId: uuidv4(),
                amount: refundAmount,
                transactionType: 'credit',
                transactionPurpose: 'refund',
                description: `Refund for cancelling item: ${itemToCancel.productName}, size: ${itemToCancel.selectedSize}`,
                createdAt: new Date()
            });

            await wallet.save();

            await Transaction.create({
                userId: order.userId,
                amount: refundAmount,
                transactionType: "credit",
                paymentMethod: "wallet",
                paymentGateway: "wallet",
                status: "completed",
                purpose: "cancellation_order_refund",
                description: remainingItems.length > 0
                    ? "Partial refund for canceled order item"
                    : "Full order cancellation refund including delivery charge",
                walletBalanceAfter: wallet.balance,
                orders: [{
                    orderId: order._id.toString(),
                    amount: refundAmount
                }]
            });
        }

       
        await Order.updateOne(
            { _id: orderId, "orderItems._id": itemToCancel._id },
            { $set: { "orderItems.$.status": "Cancelled" } }
        );

        res.json({
            success: true,
            message: "Item cancelled successfully",
            paymentMethod: order.paymentMethod,
            refundAmount: order.paymentMethod !== 'COD' ? refundAmount : 0,
            isFullCancellation: remainingItems.length === 0
        });

    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Server error",
            error: error.stack
        });
    }
};



const downloadInvoice = async (req, res) => {
    try {
        const id = req.params.id;
        const order = await Order.findOne({ orderId: id }).populate('orderItems.product');
        
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const invoiceDir = path.join(__dirname, '../invoices');
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        const filePath = path.join(invoiceDir, `invoice-${order._id}.pdf`);
        console.log(`Generating invoice at: ${filePath}`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        
        const stream = fs.createWriteStream(filePath);
        stream.on('error', (err) => {
            console.error("Stream error:", err);
            return res.status(500).json({ success: false, message: "Error generating PDF" });
        });

        doc.pipe(stream);

       
        const drawHorizontalLine = (y, width = doc.page.width - 100) => {
            doc.moveTo(50, y).lineTo(width, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
        };

        const formatCurrency = (amount) => {
            return `₹${parseFloat(amount).toFixed(2)}`;
        };

       
        doc.fontSize(28)
           .font('Helvetica-Bold')
           .text('NORD', { align: 'center' })
           .moveDown(0.2);
        
        doc.fontSize(16) 
           .font('Helvetica')
           .text('INVOICE', { align: 'center' });
        
        doc.moveDown(1);

        
        const startY = doc.y;
        const leftCol = 50;
        const rightCol = 150;
        
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Invoice No:', leftCol, startY)
            .font('Helvetica')
            .text(order._id.toString(), rightCol, startY)
            
            .font('Helvetica-Bold')
            .text('Date:', leftCol, startY + 15)
            .font('Helvetica')
            .text(order.createdOn.toLocaleDateString(), rightCol, startY + 15)
            
            .font('Helvetica-Bold')
            .text('Invoice Date:', leftCol, startY + 30)
            .font('Helvetica')
            .text(order.invoiceDate ? order.invoiceDate.toLocaleDateString() : 'Not Available', rightCol, startY + 30);

        doc.moveDown(3);

      
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Order Details', { underline: true });
        
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const columns = {
            item: 50,
            size: 200, 
            qty: 280,
            price: 340,
            total: 400,
            status: 460 
        };

        doc.font('Helvetica-Bold').fontSize(10);
        Object.keys(columns).forEach(key => {
            const header = key.charAt(0).toUpperCase() + key.slice(1);
            doc.text(header, columns[key], tableTop, { width: key === 'item' ? 140 : 60 });
        });

        doc.moveDown(0.5);
        drawHorizontalLine(doc.y);
        doc.font('Helvetica');

        let currentY = doc.y + 10;
        order.orderItems.forEach((item, index) => {
            doc.text(`${index + 1}. ${item.product.productName}`, columns.item, currentY, { width: 140 }) 
                .text(item.selectedSize || 'N/A', columns.size, currentY)
                .text(item.quantity.toString(), columns.qty, currentY)
                .text(formatCurrency(item.price), columns.price, currentY)
                .text(formatCurrency(item.quantity * item.price), columns.total, currentY)
                .text(item.status || 'Pending', columns.status, currentY); 
            
            currentY += 20;

        
            if (currentY > doc.page.height - 150) {
                doc.addPage();
                currentY = 50;
                
                doc.font('Helvetica-Bold').fontSize(10);
                Object.keys(columns).forEach(key => {
                    const header = key.charAt(0).toUpperCase() + key.slice(1);
                    doc.text(header, columns[key], currentY, { width: key === 'item' ? 140 : 60 });
                });
                
                doc.moveDown(0.5);
                drawHorizontalLine(doc.y);
                doc.font('Helvetica');
                currentY += 30;
            }
        });

        drawHorizontalLine(currentY);
        currentY += 30;

    
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Summary', 50, currentY);
        
        currentY += 25;

        const summaryItems = [
            { label: 'Total Price:', value: order.totalPrice },
            { label: 'Discount:', value: order.discount },
            { label: 'Delivery Charge:', value: order.deliveryCharge || DELIVERY_CHARGE },
        ];

     
        const summaryLabelX = 350;
        const summaryValueX = 480;
        
        doc.font('Helvetica').fontSize(10);
        summaryItems.forEach(item => {
            doc.font('Helvetica-Bold')
               .text(item.label, summaryLabelX, currentY, { width: 120, align: 'right' })
               .font('Helvetica')
               .text(formatCurrency(item.value), summaryValueX, currentY, { align: 'right' });
            currentY += 15;
        });

        doc.font('Helvetica-Bold')
           .text('Final Amount:', summaryLabelX, currentY, { width: 120, align: 'right' })
           .text(formatCurrency(order.finalAmount), summaryValueX, currentY, { align: 'right' });

        currentY += 40;
        drawHorizontalLine(currentY);
        currentY += 30;

     
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Shipping Address', 50, currentY);
        
        currentY += 25;

        const addressBoxY = currentY;
        doc.rect(50, addressBoxY, 250, 120)
           .fillAndStroke('#f6f6f6', '#cccccc');

        doc.fillColor('#000000').fontSize(10);
        const addressDetails = [
            `Name: ${order.address.name}`,
            `Address: ${order.address.addressType}`,
            `${order.address.landMark}`,
            `${order.address.city}, ${order.address.state} - ${order.address.pincode}`,
            `Phone: ${order.address.phone}`,
            `Alternate Phone: ${order.address.altPhone || 'N/A'}`
        ];

 
        addressDetails.forEach((detail, index) => {
            if (index === 0) {
                doc.font('Helvetica-Bold');
            } else {
                doc.font('Helvetica');
            }
            doc.text(detail, 60, addressBoxY + 10 + (index * 15));
        });

        const orderInfoX = 350;
        const orderInfoValueX = 450;
        
        doc.font('Helvetica-Bold')
           .text('Order Status:', orderInfoX, addressBoxY + 10)
           .font('Helvetica')
           .text(order.status, orderInfoValueX, addressBoxY + 10)
           
           .font('Helvetica-Bold')
           .text('Payment Method:', orderInfoX, addressBoxY + 25)
           .font('Helvetica')
           .text(order.paymentMethod || 'Not Available', orderInfoValueX, addressBoxY + 25);

    
        const footerY = doc.page.height - 100;
        drawHorizontalLine(footerY);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Thank you for your business!', { align: 'center' }, footerY + 15)
           .font('Helvetica')
           .fontSize(8)
           .text('This is a computer-generated invoice and does not require a signature.', { align: 'center' }, footerY + 30);

        doc.end();

        stream.on('finish', () => {
            console.log(`PDF successfully generated at ${filePath}`);
            
            const cleanupTimer = setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Temporary invoice deleted: ${filePath}`);
                    }
                } catch (err) {
                    console.error("Error deleting temporary invoice:", err);
                }
            }, 5000);

            res.download(filePath, `Invoice-${order._id}.pdf`, (err) => {
                if (err) {
                    clearTimeout(cleanupTimer);
                    console.error("Download error:", err);
                    try {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    } catch (cleanupErr) {
                        console.error("Cleanup error:", cleanupErr);
                    }
                    return res.status(500).json({ success: false, message: "Error downloading file" });
                }
            });
        });

        doc.on('error', (err) => {
            console.error("PDF generation error:", err);
            return res.status(500).json({ success: false, message: "Error generating PDF" });
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const   requestReturn=async(req,res)=>{
try {
    const {orderId,productId,size,reason}=req.body;
    if(!orderId||!productId||!size||!reason){
        return res.status(400).json({
            success:false,
            message:"Missing required fields"
        })
    }

   const order= await Order.findById(orderId);
   if(!order){
    return res.status(404).json({
        success:false,
        message:"order not found"
    })
   }
   
   const itemToReturn = order.orderItems.find(item => 
    (item._id.toString() === productId || 
     item.product.toString() === productId) &&
    item.selectedSize.trim().toLowerCase() === size.trim().toLowerCase()
);

if (!itemToReturn) {
    return res.status(400).json({
        success: false,
        message: "Item not found in the order"
    });
}


if(itemToReturn.status!=='Delivered'){
return res.status(400).json({
  success:false,
  message:'only delivered item can be returned'
})

}

itemToReturn.status='Return Requested';
itemToReturn.returnReason=reason;
itemToReturn.returnRequestDate=new Date();

await order.save();
res.json({
    success:true,
    message:'return requested  sumbitt successfully',
    status:itemToReturn.status
})



} catch (error) {
    console.error("error processing return request",error)
    res.status(500).json({
         success:false,
         message:error.message||'server error'

    })
}




}
 

const checkStock=async(req,res)=>{
try {
    const {userId}=req.body;
    if(!userId){
        return res.status(401).json({success:false,message:"user not logged in"})
    }

  const cart= await Cart.findOne({userId}).populate('items.productId');
  if(!cart||cart.items.length===0){
    return res.status(400).json({success:false,message:'cart is empty'})
  }

  let stockError=null;
  for(const item of cart.items){
    const product=item.productId;
    const sizeData = product.sizes.find(size => size.size === item.selectedSize);
    if(!sizeData||sizeData.quantity<item.quantity){
    stockError=`Sorry, only ${sizeData?.quantity || 0} units of ${product.productName} (size: ${item.selectedSize}) are available. Please reduce the quantity or wait for new stock.`;
    break;
    }
  }

  if(stockError)
  {
    return  res.status(400).json({success:false,message:stockError})
  }
res.json({
    success:true,message:'stock is available'
})

} catch (error) {
    console.error("error checking stock,error");
    res.status(500).json({success:false,message:'internal server error'})


}
}




module.exports={
    orderConfirm,
    placeOrder,
    getOrderDetails,
    cancelOrder,
    createOrder,
    downloadInvoice,
    requestReturn,
    checkStock
    

}