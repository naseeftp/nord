const mongoose=require("mongoose");
const {Schema}=mongoose;
const {v4:uuidv4}=require('uuid');


const orderSchema=new Schema({
     
    orderId:{
        type:String,
        default:()=>uuidv4(),
       unique:true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

         deliveryCharge:{
         type:Number,
         default:0

         },
       
        orderItems:[{
            product:{
                type:Schema.Types.ObjectId,
                ref:"Product",
                required:true
            },
            productName:{
                type:String,
                required:false
            },
            quantity:{
                type:Number,
                required:true
            },
            price:{
                type:Number,
                default:0
            },
            productImage:{
                type:[String],
                required:false
            },
            selectedSize:{
                type:String,
                required:false
            },
               status: {
            type: String,
            default: 'Pending',
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Return Approved','Return Rejected', ' returnReason']
        },
        returnReason: {
          type: String,
          required: false
      },
      returnRequestDate: {
          type: Date,
          required: false
      },
      returnApprovalDate: {
          type: Date,
          required: false
      },
      returnRejectionDate: {
          type: Date,
          required: false
      },
      returnRejectionReason: {
          type: String,
          required: false
      }

        }],
        totalPrice:{
            type:Number,
            required:true
        },
        discount:{
            type:Number,
            default:0
        },
        finalAmount:{
            type:Number,
           required:true

        },
        address: {
            addressType: {
              type: String,
              required: true,
            },
            name: {
              type: String,
              required: true,
            },
            city: {
              type: String,
              required: true,
            },
            landMark: {
              type: String,
              required: true,
            },
            state: {
              type: String,
              required: true,
            },
            pincode: {
              type: Number,
              required: true,
            },
            phone: {
              type: Number,
              required: true,
            },
            altPhone: {
              type: Number,
              required: true,
            },
          },
        invoiceDate:{
            type:Date,
          

        },
        status:{
            type:String,
            required:true,
            enum:['Pending','Processing','Shipped','Delivered','Cancelled','Return Requested','Returned','Return Rejected','Return Approved']

        },
        createdOn:{
           type:Date,
           default:Date.now,
           required:true 
        },
        couponApplied:{
            type:Boolean,
            default:false
        },
        paymentMethod:{
            type:String,
            required:false
        }
    
})
const Order=mongoose.model("Order",orderSchema);
module.exports=Order;