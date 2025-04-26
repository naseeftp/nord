const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema");
const Cart=require("../../models/cartSchema")
const Coupon=require('../../models/couponSchema');

const applyCoupon = async (req, res) => {
    try {
        const { productPrice, couponCode } = req.body;

        if (!couponCode) {
            return res.status(400).json({ success: false, message: 'Please enter a coupon code!' });
        }

        const findCoupon = await Coupon.findOne({ name: couponCode });

        if (!findCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found!' });
        }

        const findMinimumPrice = findCoupon.minimumPrice;

        if (productPrice < findMinimumPrice) {
            return res.status(400).json({
                success: false,
                message: `You should buy more than ₹${findMinimumPrice} to apply ${couponCode}`,
            });
        }

        if (req.session.appliedCoupon) {
            return res.status(400).json({ success: false, message: 'A coupon is already applied!' });
        }
        

        req.session.offerPrice = findCoupon.offerPrice;
        req.session.appliedCoupon = {
            couponName: couponCode,
            couponOfferPrice: findCoupon.offerPrice
        };

        return res.status(200).json({
            success: true,
            message: 'Coupon applied successfully!',
            offerPrice: findCoupon.offerPrice
        });

    } catch (error) {
        console.error('Error while applying the coupon:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong! Try again later.' });
    }
};


const removeCoupon = async (req, res) => {
    try {
        if (!req.session.appliedCoupon) {
            return res.status(400).json({ success: false, message: 'No coupon applied!' });
        }

      
        req.session.offerPrice = 0;
        req.session.appliedCoupon = null;

        return res.status(200).json({
            success: true,
            message: 'Coupon removed successfully!'
        });

    } catch (error) {
        console.error('Error while removing the coupon:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong! Try again later.' });
    }
};

module.exports={
    applyCoupon ,
    removeCoupon
}