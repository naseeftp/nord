// const Product=require("../../models/productSchema");
// const Category=require("../../models/categorySchema");
// const Brand=require("../../models/brandSchema");
// const User=require("../../models/userSchema");
// const Order=require("../../models/orderSchema");
// const fs=require("fs");
// const path=require("path");
// const sharp=require("sharp");
// const Address = require('../../models/addressSchema')
// const Wallet=require('../../models/walletSchema')
// const Transaction=require('../../models/transactionSchema')
// const mongoose = require('mongoose');


// const getOrderListPageAdmin = async (req, res) => {
//     try {
//         const itemsPerPage = 3;
//         const currentPage = parseInt(req.query.page) || 1;
//         const search = req.query.search || ''; 

//         let query = {};
//         if (search) {
//             query.orderId = { $regex: search, $options: 'i' }; 
//         }

//         const totalOrders = await Order.countDocuments(query);
//         const totalPages = Math.ceil(totalOrders / itemsPerPage);

//         const orders = await Order.find(query, "orderId totalPrice finalAmount status createdOn userId paymentMethod")
//             .populate("userId", "name")
//             .sort({ createdOn: -1 })
//             .skip((currentPage - 1) * itemsPerPage)
//             .limit(itemsPerPage);

//         res.render("orderlist", {
//             orders,
//             totalPages,
//             currentPage,
//             hasNextPage: currentPage < totalPages,
//             hasPreviousPage: currentPage > 1,
//             search 
//         });
//     } catch (error) {
//         console.error(error);
//         res.redirect("/pageError");
//     }
// };

// const getOrderDetailsPageAdmin = async (req, res) => {
//     try {
//         const orderId = req.params.orderId;
        
//         const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
//         let findOrder;
//         if (isValidObjectId) {
//             findOrder = await Order.findOne({ _id: orderId })
//                 .populate('userId', 'name') 
//                 .populate('orderItems.product', 'productName productImage');
//         } else {
//             findOrder = await Order.findOne({ orderId: orderId })
//                 .populate('userId', 'name') 
//                 .populate('orderItems.product', 'productName productImage');
//         }

      
        

//         if (!findOrder) {
//             return res.status(404).send('Order not found');
//         }
        
//         console.log('Found order:', JSON.stringify(findOrder, null, 2)); 
        
//         res.render("adminOrderdetails", { 
//             order: findOrder, 
//             address: findOrder.address 
//         });
//     } catch (error) {
//         console.error("Error fetching order details:", error);
//         res.redirect("/pageError");
//     }
// };


// const updateOrderStatus = async (req, res) => {
//     try {
//       const { status } = req.body;
  
//       const orderId = req.params.orderId
//       const order = await Order.findByIdAndUpdate(
//         orderId,
//         { status: status },
//         { new: true}
//       );
  
//       if (!order) {
//         return res.status(404).json({ 
//           success: false, 
//           message: 'Order not found' 
//         });
//       }
//        res.json({ 
//         success: true, 
//         message: 'Status updated successfully',
//         order 
//       });
  
//     } catch (error) {
//       console.error('Status update error:', error);
//       res.status(500).json({ 
//         success: false, 
//         message: error.message || 'Server error' 
//       });
//     }
//   };

// const updateItemStatus = async (req, res) => {
//   try {
//       const { orderId, itemId, status } = req.body;

//       const order = await Order.findById(orderId).populate("orderItems.product");
//       if (!order) {
//           return res.status(404).json({
//               success: false,
//               message: "Order not found",
//           });
//       }

//       const item = order.orderItems.find(
//           (item) => item._id.toString() === itemId
//       );
//       if (!item) {
//           return res.status(404).json({
//               success: false,
//               message: "Item not found",
//           });
//       }

//       const statusFlow = ["Pending", "Processing", "Shipped", "Delivered"];
//       const currentStatusIndex = statusFlow.indexOf(item.status);
//       const newStatusIndex = statusFlow.indexOf(status);

//       if (
//           newStatusIndex < currentStatusIndex &&
//           status !== "Cancelled" &&
//           !status.includes("Return")
//       ) {
//           return res.status(400).json({
//               success: false,
//               message: "Cannot revert to previous status",
//           });
//       }

//       if (item.status === "Cancelled") {
//           return res.status(400).json({
//               success: false,
//               message: "Item is already cancelled",
//           });
//       }

//       const previousStatus = item.status;
//       item.status = status;

//       if (status === "Cancelled" && order.paymentMethod !== "COD") {
//           const itemPrice = item.price * item.quantity;
//           const remainingNonCancelledItems = order.orderItems.filter(
//               (i) => i._id.toString() !== itemId && i.status !== "Cancelled"
//           );
//           let refundAmount = itemPrice;
//           let refundDescription = `Refund for cancelled item ${item.product.productName}, size: ${item.selectedSize}`;
//           if (remainingNonCancelledItems.length === 0 && order.deliveryCharge > 0) {
//               refundAmount += order.deliveryCharge;
//               refundDescription += " (including delivery charge)";
//               order.deliveryCharge = 0;
//           }

//           let wallet = await Wallet.findOne({ userId: order.userId });
//           if (!wallet) {
//               wallet = new Wallet({
//                   userId: order.userId,
//                   balance: 0,
//                   refundAmount: 0,
//                   totalDebited: 0,
//                   transactions: [],
//               });
//           }

//           wallet.balance += refundAmount;
//           wallet.refundAmount += refundAmount;

//           const { v4: uuidv4 } = require("uuid");
//           const transactionId = uuidv4();
//           wallet.transactions.push({
//               transactionId,
//               amount: refundAmount,
//               transactionType: "credit",
//               paymentMethod: "wallet",
//               paymentGateway: "wallet",
//               transactionPurpose: "add",
//               status: "completed",
//               purpose:
//                   remainingNonCancelledItems.length === 0
//                       ? "cancellation_order_refund"
//                       : "return_order_refund",
//               description: refundDescription,
//               walletBalanceAfter: wallet.balance,
//               orders: [
//                   {
//                       orderId: order._id.toString(),
//                       amount: refundAmount,
//                   },
//               ],
//               createdAt: new Date(),
//           });

//           await wallet.save();

//           await Transaction.create({
//               userId: order.userId,
//               transactionId,
//               amount: refundAmount,
//               transactionType: "credit",
//               paymentMethod: "wallet",
//               paymentGateway: "wallet",
//               status: "completed",
//               purpose:
//                   remainingNonCancelledItems.length === 0
//                       ? "cancellation_order_refund"
//                       : "return_order_refund",
//               description: refundDescription,
//               walletBalanceAfter: wallet.balance,
//               orders: [
//                   {
//                       orderId: order._id.toString(),
//                       amount: refundAmount,
//                   },
//               ],
//               createdAt: new Date(),
//           });

//           const product = await Product.findById(item.product);
//           if (product) {
//               const sizeIndex = product.sizes.findIndex(
//                   (s) => s.size === item.selectedSize
//               );
//               if (sizeIndex !== -1) {
//                   product.sizes[sizeIndex].quantity += item.quantity;
//                   await product.save();
//               }
//           }
//       }

//       const anyDelivered = order.orderItems.some((i) => i.status === "Delivered");

//       if (anyDelivered) {
//           order.status = "Delivered"; 
//       } else {
//           const allReturnRejected = order.orderItems.every((i) => i.status === "Return Rejected");
//           const allReturned = order.orderItems.every((i) => i.status === "Returned");
//           const allCancelled = order.orderItems.every((i) => i.status === "Cancelled");
//           const allDelivered = order.orderItems.every((i) => i.status === "Delivered");
//           const allShipped = order.orderItems.every((i) => i.status === "Shipped");
//           const anyReturnRequested = order.orderItems.some((i) => i.status === "Return Requested");
//           const anyReturnApproved = order.orderItems.some((i) => i.status === "Return Approved");

//           if (allReturnRejected) {
//               order.status = "Return Rejected";
//           } else if (allReturned) {
//               order.status = "Returned";
//           } else if (allCancelled) {
//               order.status = "Cancelled";
//           } else if (allDelivered) {
//               order.status = "Delivered";
//           } else if (allShipped) {
//               order.status = "Shipped";
//           } else if (anyReturnRequested) {
//               order.status = "Return Requested";
//           } else if (anyReturnApproved) {
//               order.status = "Return Approved";
//           } else {
//               const itemStatuses = order.orderItems.map((i) => i.status);
//               const statusPriority = [
//                   "Pending",
//                   "Processing",
//                   "Shipped",
//                   "Delivered",
//                   "Cancelled",
//                   "Return Requested",
//                   "Return Approved",
//                   "Return Rejected",
//                   "Returned",
//               ];
//               const earliestStatus = itemStatuses.reduce((earliest, current) => {
//                   return statusPriority.indexOf(current) <
//                       statusPriority.indexOf(earliest)
//                       ? current
//                       : earliest;
//               }, statusPriority[0]);
//               order.status = earliestStatus;
//           }
//       }

//       if (status === "Cancelled" && previousStatus !== "Delivered") {
//           const remainingNonCancelledItems = order.orderItems.filter(
//               (i) => i._id.toString() !== itemId && i.status !== "Cancelled"
//           );
//           order.totalPrice -= item.price * item.quantity;
//           order.finalAmount -=
//               remainingNonCancelledItems.length === 0
//                   ? item.price * item.quantity + order.deliveryCharge
//                   : item.price * item.quantity;
//       }

//       await order.save();

//       res.json({
//           success: true,
//           message: "Item status updated successfully",
//           order,
//       });
//   } catch (error) {
//       console.error("Item status update error:", error);
//       res.status(500).json({
//           success: false,
//           message: error.message || "Server error",
//       });
//   }
// };

// const handleItemReturn = async (req, res) => {
//   try {
//       const { orderId, itemId, action, rejectionReason } = req.body;

//       const order = await Order.findById(orderId)
//           .populate('userId')
//           .populate('orderItems.product');

//       if (!order) {
//           return res.status(404).json({
//               success: false,
//               message: 'Order not found'
//           });
//       }

//       const item = order.orderItems.id(itemId);
//       if (!item) {
//           return res.status(404).json({
//               success: false,
//               message: 'Item not found'
//           });
//       }

//       if (item.status !== 'Return Requested') {
//           return res.status(400).json({
//               success: false,
//               message: `Item is in invalid state: ${item.status}`
//           });
//       }

//       if (action === 'approve') {
//           const refundAmount = item.price * item.quantity;
//           let wallet = await Wallet.findOne({ userId: order.userId._id });
//           if (!wallet) {
//               wallet = new Wallet({
//                   userId: order.userId._id,
//                   balance: 0,
//                   refundAmount: 0,
//                   totalDebited: 0
//               });
//           }

//           wallet.balance += refundAmount;
//           wallet.refundAmount += refundAmount;

//           wallet.transactions.push({
//               amount: refundAmount,
//               transactionType: 'credit',
//               transactionPurpose: 'refund',
//               description: `Refund for returned item in order #${order.orderId}`,
//               createdAt: new Date(),
//           });

//           await wallet.save();

//           await Transaction.create({
//               userId: order.userId._id,
//               amount: refundAmount,
//               transactionType: "credit",
//               paymentMethod: "wallet",
//               paymentGateway: "wallet",
//               status: "completed",
//               purpose: "return_order_refund",
//               description: `Refund for item ${item.product.productName} in order #${order.orderId}`,
//               walletBalanceAfter: wallet.balance,
//               orders: [{
//                   orderId: order._id.toString(),
//                   amount: refundAmount
//               }]
//           });

//           item.status = 'Return Approved';
//           item.returnApprovalDate = new Date();
//           item.returnRejectionReason = undefined;

//       } else if (action === 'reject') {
//           if (!rejectionReason || rejectionReason.trim() === '') {
//               return res.status(400).json({
//                   success: false,
//                   message: 'Rejection reason is required'
//               });
//           }
//           item.status = 'Return Rejected';
//           item.returnRejectionDate = new Date();
//           item.returnRejectionReason = rejectionReason;
//           item.returnApprovalDate = undefined;
//           order.markModified('orderItems');
//       } else {
//           return res.status(400).json({
//               success: false,
//               message: 'Invalid action'
//           });
//       }

//       // Check if any item is "Delivered" to prioritize order status
//       const anyDelivered = order.orderItems.some((i) => i.status === "Delivered");

//       if (anyDelivered) {
//           order.status = "Delivered"; // Prioritize Delivered if any item is Delivered
//       } else {
//           const allReturnRejected = order.orderItems.every((i) => i.status === 'Return Rejected');
//           const allReturned = order.orderItems.every((i) => i.status === 'Returned');
//           const allCancelled = order.orderItems.every((i) => i.status === 'Cancelled');
//           const allDelivered = order.orderItems.every((i) => i.status === 'Delivered');
//           const allShipped = order.orderItems.every((i) => i.status === 'Shipped');
//           const anyReturnRequested = order.orderItems.some((i) => i.status === 'Return Requested');
//           const anyReturnApproved = order.orderItems.some((i) => i.status === 'Return Approved');

//           if (allReturnRejected) {
//               order.status = 'Return Rejected';
//           } else if (allReturned) {
//               order.status = 'Returned';
//           } else if (allCancelled) {
//               order.status = 'Cancelled';
//           } else if (allDelivered) {
//               order.status = 'Delivered';
//           } else if (allShipped) {
//               order.status = 'Shipped';
//           } else if (anyReturnRequested) {
//               order.status = 'Return Requested';
//           } else if (anyReturnApproved) {
//               order.status = 'Return Approved';
//           } else {
//               const itemStatuses = order.orderItems.map((i) => i.status);
//               const statusPriority = [
//                   "Pending",
//                   "Processing",
//                   "Shipped",
//                   "Delivered",
//                   "Cancelled",
//                   "Return Requested",
//                   "Return Approved",
//                   "Return Rejected",
//                   "Returned",
//               ];
//               const earliestStatus = itemStatuses.reduce((earliest, current) => {
//                   return statusPriority.indexOf(current) <
//                       statusPriority.indexOf(earliest)
//                       ? current
//                       : earliest;
//               }, statusPriority[0]);
//               order.status = earliestStatus;
//           }
//       }

//       await order.save();

//       res.json({
//           success: true,
//           message: `Return ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
//           order
//       });

//   } catch (error) {
//       console.error('Error handling return request:', error);
//       res.status(500).json({
//           success: false,
//           message: error.message || 'Server error'
//       });
//   }
// };






// async function checkAllItemsDelivered(orderId, updatedItemId) {
//     const order = await Order.findById(orderId);
//     const allDelivered = order.orderItems.every(item => 
//         item._id.toString() === updatedItemId || item.status === 'Delivered'
//     );
//     return allDelivered ? 'Delivered' : order.status;
// }




//   module.exports={
//     getOrderListPageAdmin,
//     getOrderDetailsPageAdmin ,
//     updateOrderStatus,
//     updateItemStatus,
//     handleItemReturn
  
// }



const mongoose = require("mongoose");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema"); // Assuming Wallet schema exists
const Transaction = require("../../models/transactionSchema"); // Assuming Transaction schema exists

const getOrderListPageAdmin = async (req, res) => {
    try {
        const itemsPerPage = 3;
        const currentPage = parseInt(req.query.page) || 1;
        const search = req.query.search || '';

        let query = {};
        if (search) {
            query.orderId = { $regex: search, $options: 'i' };
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / itemsPerPage);

        const orders = await Order.find(query, "orderId totalPrice finalAmount status createdOn userId paymentMethod")
            .populate("userId", "name")
            .sort({ createdOn: -1 })
            .skip((currentPage - 1) * itemsPerPage)
            .limit(itemsPerPage);

        res.render("orderlist", {
            orders,
            totalPages,
            currentPage,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
            search
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageError");
    }
};

const getOrderDetailsPageAdmin = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
        let findOrder;
        if (isValidObjectId) {
            findOrder = await Order.findOne({ _id: orderId })
                .populate('userId', 'name')
                .populate('orderItems.product', 'productName productImage');
        } else {
            findOrder = await Order.findOne({ orderId: orderId })
                .populate('userId', 'name')
                .populate('orderItems.product', 'productName productImage');
        }

        if (!findOrder) {
            return res.status(404).send('Order not found');
        }

        res.render("adminOrderdetails", {
            order: findOrder,
            address: findOrder.address
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.redirect("/pageError");
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const orderId = req.params.orderId;
        const order = await Order.findByIdAndUpdate(
            orderId,
            { status: status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        res.json({
            success: true,
            message: 'Status updated successfully',
            order
        });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId, status } = req.body;

        const order = await Order.findById(orderId).populate("orderItems.product");
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        const item = order.orderItems.find(
            (item) => item._id.toString() === itemId
        );
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found",
            });
        }

        const statusFlow = ["Pending", "Processing", "Shipped", "Delivered"];
        const currentStatusIndex = statusFlow.indexOf(item.status);
        const newStatusIndex = statusFlow.indexOf(status);

        if (
            newStatusIndex < currentStatusIndex &&
            status !== "Cancelled" &&
            !status.includes("Return")
        ) {
            return res.status(400).json({
                success: false,
                message: "Cannot revert to previous status",
            });
        }

        if (item.status === "Cancelled") {
            return res.status(400).json({
                success: false,
                message: "Item is already cancelled",
            });
        }

        const previousStatus = item.status;
        item.status = status;

        if (status === "Cancelled" && order.paymentMethod !== "COD") {
            // Calculate the proportional discount for the item
            const itemTotalPrice = item.price * item.quantity;
            const totalOrderPrice = order.orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            const discountProportion = order.discount && totalOrderPrice > 0 ? itemTotalPrice / totalOrderPrice : 0;
            const itemDiscount = order.discount * discountProportion;
            let refundAmount = itemTotalPrice - itemDiscount; // Refund after applying proportional discount
            let refundDescription = `Refund for cancelled item ${item.product.productName}, size: ${item.selectedSize}`;

            // Handle delivery charge refund if all non-cancelled items are gone
            const remainingNonCancelledItems = order.orderItems.filter(
                (i) => i._id.toString() !== itemId && i.status !== "Cancelled"
            );
            if (remainingNonCancelledItems.length === 0 && order.deliveryCharge > 0) {
                refundAmount += order.deliveryCharge;
                refundDescription += " (including delivery charge)";
                order.deliveryCharge = 0;
            }

            let wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    refundAmount: 0,
                    totalDebited: 0,
                    transactions: [],
                });
            }

            wallet.balance += refundAmount;
            wallet.refundAmount += refundAmount;

            const { v4: uuidv4 } = require("uuid");
            const transactionId = uuidv4();
            wallet.transactions.push({
                transactionId,
                amount: refundAmount,
                transactionType: "credit",
                paymentMethod: "wallet",
                paymentGateway: "wallet",
                transactionPurpose: "add",
                status: "completed",
                purpose:
                    remainingNonCancelledItems.length === 0
                        ? "cancellation_order_refund"
                        : "return_order_refund",
                description: refundDescription,
                walletBalanceAfter: wallet.balance,
                orders: [
                    {
                        orderId: order._id.toString(),
                        amount: refundAmount,
                    },
                ],
                createdAt: new Date(),
            });

            await wallet.save();

            await Transaction.create({
                userId: order.userId,
                transactionId,
                amount: refundAmount,
                transactionType: "credit",
                paymentMethod: "wallet",
                paymentGateway: "wallet",
                status: "completed",
                purpose:
                    remainingNonCancelledItems.length === 0
                        ? "cancellation_order_refund"
                        : "return_order_refund",
                description: refundDescription,
                walletBalanceAfter: wallet.balance,
                orders: [
                    {
                        orderId: order._id.toString(),
                        amount: refundAmount,
                    },
                ],
                createdAt: new Date(),
            });

            const product = await Product.findById(item.product);
            if (product) {
                const sizeIndex = product.sizes.findIndex(
                    (s) => s.size === item.selectedSize
                );
                if (sizeIndex !== -1) {
                    product.sizes[sizeIndex].quantity += item.quantity;
                    await product.save();
                }
            }
        }

        const anyDelivered = order.orderItems.some((i) => i.status === "Delivered");

        if (anyDelivered) {
            order.status = "Delivered";
        } else {
            const allReturnRejected = order.orderItems.every((i) => i.status === "Return Rejected");
            const allReturned = order.orderItems.every((i) => i.status === "Returned");
            const allCancelled = order.orderItems.every((i) => i.status === "Cancelled");
            const allDelivered = order.orderItems.every((i) => i.status === "Delivered");
            const allShipped = order.orderItems.every((i) => i.status === "Shipped");
            const anyReturnRequested = order.orderItems.some((i) => i.status === "Return Requested");
            const anyReturnApproved = order.orderItems.some((i) => i.status === "Return Approved");

            if (allReturnRejected) {
                order.status = "Return Rejected";
            } else if (allReturned) {
                order.status = "Returned";
            } else if (allCancelled) {
                order.status = "Cancelled";
            } else if (allDelivered) {
                order.status = "Delivered";
            } else if (allShipped) {
                order.status = "Shipped";
            } else if (anyReturnRequested) {
                order.status = "Return Requested";
            } else if (anyReturnApproved) {
                order.status = "Return Approved";
            } else {
                const itemStatuses = order.orderItems.map((i) => i.status);
                const statusPriority = [
                    "Pending",
                    "Processing",
                    "Shipped",
                    "Delivered",
                    "Cancelled",
                    "Return Requested",
                    "Return Approved",
                    "Return Rejected",
                    "Returned",
                ];
                const earliestStatus = itemStatuses.reduce((earliest, current) => {
                    return statusPriority.indexOf(current) <
                        statusPriority.indexOf(earliest)
                        ? current
                        : earliest;
                }, statusPriority[0]);
                order.status = earliestStatus;
            }
        }

        if (status === "Cancelled" && previousStatus !== "Delivered") {
            const itemTotalPrice = item.price * item.quantity;
            const totalOrderPrice = order.orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            const discountProportion = order.discount && totalOrderPrice > 0 ? itemTotalPrice / totalOrderPrice : 0;
            const itemDiscount = order.discount * discountProportion;
            const refundAmount = itemTotalPrice - itemDiscount;

            const remainingNonCancelledItems = order.orderItems.filter(
                (i) => i._id.toString() !== itemId && i.status !== "Cancelled"
            );
            order.totalPrice -= itemTotalPrice;
            order.finalAmount -=
                remainingNonCancelledItems.length === 0
                    ? refundAmount + order.deliveryCharge
                    : refundAmount;
        }

        await order.save();

        res.json({
            success: true,
            message: "Item status updated successfully",
            order,
        });
    } catch (error) {
        console.error("Item status update error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Server error",
        });
    }
};

// const handleItemReturn = async (req, res) => {
//     try {
//         const { orderId, itemId, action, rejectionReason } = req.body;

//         const order = await Order.findById(orderId)
//             .populate('userId')
//             .populate('orderItems.product');

//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Order not found'
//             });
//         }

//         const item = order.orderItems.id(itemId);
//         if (!item) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Item not found'
//             });
//         }

//         if (item.status !== 'Return Requested') {
//             return res.status(400).json({
//                 success: false,
//                 message: `Item is in invalid state: ${item.status}`
//             });
//         }

//         if (action === 'approve') {
          
//             const itemTotalPrice = item.price * item.quantity;
//             const totalOrderPrice = order.orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
//             const discountProportion = order.discount && totalOrderPrice > 0 ? itemTotalPrice / totalOrderPrice : 0;
//             const itemDiscount = order.discount * discountProportion;
//             const refundAmount = itemTotalPrice - itemDiscount; 
//             let refundDescription = `Refund for returned item ${item.product.productName} in order #${order.orderId}`;

//             let wallet = await Wallet.findOne({ userId: order.userId._id });
//             if (!wallet) {
//                 wallet = new Wallet({
//                     userId: order.userId._id,
//                     balance: 0,
//                     refundAmount: 0,
//                     totalDebited: 0
//                 });
//             }

//             wallet.balance += refundAmount;
//             wallet.refundAmount += refundAmount;

//             wallet.transactions.push({
//                 amount: refundAmount,
//                 transactionType: 'credit',
//                 transactionPurpose: 'refund',
//                 description: refundDescription,
//                 createdAt: new Date(),
//             });

//             await wallet.save();

//             await Transaction.create({
//                 userId: order.userId._id,
//                 amount: refundAmount,
//                 transactionType: "credit",
//                 paymentMethod: "wallet",
//                 paymentGateway: "wallet",
//                 status: "completed",
//                 purpose: "return_order_refund",
//                 description: refundDescription,
//                 walletBalanceAfter: wallet.balance,
//                 orders: [{
//                     orderId: order._id.toString(),
//                     amount: refundAmount
//                 }]
//             });

//             item.status = 'Return Approved';
//             item.returnApprovalDate = new Date();
//             item.returnRejectionReason = undefined;

            
//             order.totalPrice -= itemTotalPrice;
//             order.finalAmount -= refundAmount;
//         } else if (action === 'reject') {
//             if (!rejectionReason || rejectionReason.trim() === '') {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Rejection reason is required'
//                 });
//             }
//             item.status = 'Return Rejected';
//             item.returnRejectionDate = new Date();
//             item.returnRejectionReason = rejectionReason;
//             item.returnApprovalDate = undefined;
//             order.markModified('orderItems');
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid action'
//             });
//         }

//         const anyDelivered = order.orderItems.some((i) => i.status === "Delivered");

//         if (anyDelivered) {
//             order.status = "Delivered";
//         } else {
//             const allReturnRejected = order.orderItems.every((i) => i.status === 'Return Rejected');
//             const allReturned = order.orderItems.every((i) => i.status === 'Returned');
//             const allCancelled = order.orderItems.every((i) => i.status === 'Cancelled');
//             const allDelivered = order.orderItems.every((i) => i.status === 'Delivered');
//             const allShipped = order.orderItems.every((i) => i.status === 'Shipped');
//             const anyReturnRequested = order.orderItems.some((i) => i.status === 'Return Requested');
//             const anyReturnApproved = order.orderItems.some((i) => i.status === 'Return Approved');

//             if (allReturnRejected) {
//                 order.status = 'Return Rejected';
//             } else if (allReturned) {
//                 order.status = 'Returned';
//             } else if (allCancelled) {
//                 order.status = 'Cancelled';
//             } else if (allDelivered) {
//                 order.status = 'Delivered';
//             } else if (allShipped) {
//                 order.status = 'Shipped';
//             } else if (anyReturnRequested) {
//                 order.status = 'Return Requested';
//             } else if (anyReturnApproved) {
//                 order.status = 'Return Approved';
//             } else {
//                 const itemStatuses = order.orderItems.map((i) => i.status);
//                 const statusPriority = [
//                     "Pending",
//                     "Processing",
//                     "Shipped",
//                     "Delivered",
//                     "Cancelled",
//                     "Return Requested",
//                     "Return Approved",
//                     "Return Rejected",
//                     "Returned",
//                 ];
//                 const earliestStatus = itemStatuses.reduce((earliest, current) => {
//                     return statusPriority.indexOf(current) <
//                         statusPriority.indexOf(earliest)
//                         ? current
//                         : earliest;
//                 }, statusPriority[0]);
//                 order.status = earliestStatus;
//             }
//         }

//         await order.save();

//         res.json({
//             success: true,
//             message: `Return ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
//             order
//         });
//     } catch (error) {
//         console.error('Error handling return request:', error);
//         res.status(500).json({
//             success: false,
//             message: error.message || 'Server error'
//         });
//     }
// };


const handleItemReturn = async (req, res) => {
  try {
      const { orderId, itemId, action, rejectionReason } = req.body;

      const order = await Order.findById(orderId)
          .populate('userId')
          .populate('orderItems.product');

      if (!order) {
          return res.status(404).json({
              success: false,
              message: 'Order not found'
          });
      }

      const item = order.orderItems.id(itemId);
      if (!item) {
          return res.status(404).json({
              success: false,
              message: 'Item not found'
          });
      }

      if (item.status !== 'Return Requested') {
          return res.status(400).json({
              success: false,
              message: `Item is in invalid state: ${item.status}`
          });
      }

      if (action === 'approve') {
          const itemTotalPrice = item.price * item.quantity;
          const totalOrderPrice = order.orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
          const discountProportion = order.discount && totalOrderPrice > 0 ? itemTotalPrice / totalOrderPrice : 0;
          const itemDiscount = order.discount * discountProportion;
          let refundAmount = itemTotalPrice - itemDiscount;
          let refundDescription = `Refund for returned item ${item.product.productName} in order #${order.orderId}`;

          let wallet = await Wallet.findOne({ userId: order.userId._id });
          if (!wallet) {
              wallet = new Wallet({
                  userId: order.userId._id,
                  balance: 0,
                  refundAmount: 0,
                  totalDebited: 0
              });
          }

          wallet.balance += refundAmount;
          wallet.refundAmount += refundAmount;

          wallet.transactions.push({
              amount: refundAmount,
              transactionType: 'credit',
              transactionPurpose: 'refund',
              description: refundDescription,
              createdAt: new Date(),
          });

          await wallet.save();

          await Transaction.create({
              userId: order.userId._id,
              amount: refundAmount,
              transactionType: "credit",
              paymentMethod: "wallet",
              paymentGateway: "wallet",
              status: "completed",
              purpose: "return_order_refund",
              description: refundDescription,
              walletBalanceAfter: wallet.balance,
              orders: [{
                  orderId: order._id.toString(),
                  amount: refundAmount
              }]
          });

          const product = await Product.findById(item.product);
          if (product) {
              const sizeIndex = product.sizes.findIndex(
                  (s) => s.size === item.selectedSize
              );
              if (sizeIndex !== -1) {
                  product.sizes[sizeIndex].quantity += item.quantity;
                  await product.save();
              }
          }

          item.status = 'Return Approved';
          item.returnApprovalDate = new Date();
          item.returnRejectionReason = undefined;

          order.totalPrice -= itemTotalPrice;
          order.finalAmount -= refundAmount;
      } else if (action === 'reject') {
          if (!rejectionReason || rejectionReason.trim() === '') {
              return res.status(400).json({
                  success: false,
                  message: 'Rejection reason is required'
              });
          }
          item.status = 'Return Rejected';
          item.returnRejectionDate = new Date();
          item.returnRejectionReason = rejectionReason;
          item.returnApprovalDate = undefined;
          order.markModified('orderItems');
      } else {
          return res.status(400).json({
              success: false,
              message: 'Invalid action'
          });
      }

      const anyDelivered = order.orderItems.some((i) => i.status === "Delivered");

      if (anyDelivered) {
          order.status = "Delivered";
      } else {
          const allReturnRejected = order.orderItems.every((i) => i.status === 'Return Rejected');
          const allReturned = order.orderItems.every((i) => i.status === 'Returned');
          const allCancelled = order.orderItems.every((i) => i.status === 'Cancelled');
          const allDelivered = order.orderItems.every((i) => i.status === 'Delivered');
          const allShipped = order.orderItems.every((i) => i.status === 'Shipped');
          const anyReturnRequested = order.orderItems.some((i) => i.status === 'Return Requested');
          const anyReturnApproved = order.orderItems.some((i) => i.status === 'Return Approved');

          if (allReturnRejected) {
              order.status = 'Return Rejected';
          } else if (allReturned) {
              order.status = 'Returned';
          } else if (allCancelled) {
              order.status = 'Cancelled';
          } else if (allDelivered) {
              order.status = 'Delivered';
          } else if (allShipped) {
              order.status = 'Shipped';
          } else if (anyReturnRequested) {
              order.status = 'Return Requested';
          } else if (anyReturnApproved) {
              order.status = 'Return Approved';
          } else {
              const itemStatuses = order.orderItems.map((i) => i.status);
              const statusPriority = [
                  "Pending",
                  "Processing",
                  "Shipped",
                  "Delivered",
                  "Cancelled",
                  "Return Requested",
                  "Return Approved",
                  "Return Rejected",
                  "Returned",
              ];
              const earliestStatus = itemStatuses.reduce((earliest, current) => {
                  return statusPriority.indexOf(current) <
                      statusPriority.indexOf(earliest)
                      ? current
                      : earliest;
              }, statusPriority[0]);
              order.status = earliestStatus;
          }
      }

      await order.save();

      res.json({
          success: true,
          message: `Return ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
          order
      });
  } catch (error) {
      console.error('Error handling return request:', error);
      res.status(500).json({
          success: false,
          message: error.message || 'Server error'
      });
  }
};
async function checkAllItemsDelivered(orderId, updatedItemId) {
    const order = await Order.findById(orderId);
    const allDelivered = order.orderItems.every(item =>
        item._id.toString() === updatedItemId || item.status === 'Delivered'
    );
    return allDelivered ? 'Delivered' : order.status;
}

module.exports = {
    getOrderListPageAdmin,
    getOrderDetailsPageAdmin,
    updateOrderStatus,
    updateItemStatus,
    handleItemReturn
};