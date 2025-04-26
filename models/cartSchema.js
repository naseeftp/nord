const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        selectedSize: {
            type: String,   
            required: false    
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['placed', 'cancelled', 'shipped', 'delivered'],   
            default: 'placed'
        },
        cancellationReason: {
            type: String,
            default: 'none'
        }
    }],
}, { timestamps: true })

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart
