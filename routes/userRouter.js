const express=require("express")
const router=express.Router();
const passport = require("../config/passport");
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const productController=require("../controllers/user/productController");

const cartController = require("../controllers/user/cartController");
const orderController = require("../controllers/user/orderController")
const wishlistController=require("../controllers/user/wishlistController");
const couponController=require('../controllers/user/couponController')
const { Admin } = require("mongodb");

const walletController=require('../controllers/user/walletController')

//  invoice
const Order = require('../models/orderSchema');
const { generateInvoicePDF } =require("../controllers/user/orderController")
const fs = require('fs');
const User = require('../models/userSchema');
const Cart= require('../models/cartSchema');






router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomepage)
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);

router.get('/auth/google',passport.authenticate('google'))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user._id
  
    res.redirect('/')
});
//loginmanagement
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);
router.get("/logout",userController.logout)
//profile management
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password", profileController.resetPassword)
router.get('/userProfile',userAuth,profileController.userProfile);
router.get('/change-email',userAuth,profileController.changeEmail);
router.post('/change-email',userAuth,profileController.changeEmailValid);
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp);
router.post("/update-email",userAuth,profileController.updateEmail);
router.get('/change-password',userAuth,profileController.changePassword);
router.post('/change-password',userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp);
router.get('/useraddress', userAuth,profileController.getAddress);
router.get('/orders',userAuth,profileController.getOrders)

 router.get('/updatePassword',userAuth,profileController.getUpdatePassword)
 router.post('/updatePassword',userAuth,profileController.updatePassword)
 router.get('/editProfile',userAuth,profileController.getEditProfile)
 router.post('/editProfile',userAuth,profileController.updateProfile)

router.get("/shop",userController.loadShoppingPage);
router.get('/filter',userController.filterProduct);
router.get('/filterPrice',userController.filterByPrice);
router.get('/filterColor', userController.filterByColor);
router.post("/search",userController.searchProducts);
router.get("/productDetails",productController.productDetails);


//address management
router.get("/addAddress",userAuth,profileController.addAddress)
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);
//wishlist
router.get('/wishlist',userAuth,wishlistController.loadWishlist)
router.post('/addToWishlist',userAuth,wishlistController.addToWishlist)
router.get('/removeFromWishlist',userAuth,wishlistController.removeProduct);
router.get('/product-sizes/:productId', wishlistController.getProductSizes)


//cartmangement
router.get("/cart", userAuth, cartController.getCartPage)
router.post("/addToCart",userAuth, cartController.addToCart)
router.post("/changeQuantity", userAuth,cartController.changeQuantity)
router.get("/deleteItem", userAuth, cartController.deleteProduct)
router.get('/product-sizes/:productId',userController.productSize)
router.post('/add-to-cart',userController.addToCart)
//checkoutmangement
router.get('/checkout',userAuth,userController. loadCheckout)
router.get('/addaddresscheck',userAuth,userController.addAddresscheckout)
router.post("/addaddresscheck",userAuth,userController.postAddAddresscheckout);
router.get('/editAddresscheck',userAuth,userController.editAddresscheckout)
router.post('/editAddresscheck',userAuth,userController.postEditAddresscheckout)

//ordermangement
router.get('/orderConfirm',userAuth,orderController.orderConfirm)
router.post('/place-order',userAuth, orderController.placeOrder)
router.get('/orderDetails',userAuth, orderController.getOrderDetails)
router.post('/cancelOrder',userAuth,orderController.cancelOrder)
router.post('/applyCoupon',userAuth,couponController.applyCoupon)
router.post('/removeCoupon', userAuth, couponController.removeCoupon);

//razorpay
router.post('/createOrder',userAuth,orderController.createOrder);
router.get('/downloadInvoice/:id', userAuth, orderController.downloadInvoice);
  


// wallet management
router.get('/wallet',userAuth, walletController.loadWallet);
router.get('/wallethistory',userAuth,walletController.getWallethistory)
router.post('/wallet/create-razorpay-order', userAuth, walletController.createRazorpayOrder);
router.post('/wallet/verify-payment', userAuth, walletController.verifyPayment);
router.post('/wallet/withdraw-money', userAuth, walletController.withdrawMoney);


router.post('/requestReturn',userAuth,orderController.requestReturn)
router.get('/wallet/balance',userAuth,walletController.getWalletBalance);
router.post('/check-stock',userAuth, orderController.checkStock);
router.get('/paymentFailure',userAuth,userController.paymentFailure)
router.get('/wallet/get-balance',userAuth,walletController.getWalletBalance)
router.get('/wallet/get-data',userAuth,walletController.getWalletData);

router.get('/getNavCounts', async (req, res) => {
    try {
      const userId = req.session.user;
      
      if(!userId) {
        return res.json({ status: true, wishlistCount: 0, cartCount: 0 });
      }
  
      const user = await User.findById(userId);
      const cart = await Cart.findOne({ userId });
  
      res.json({
        status: true,
        wishlistCount: user?.wishlist?.length || 0,
        cartCount: cart?.items?.length || 0
      });
    } catch (error) {
      console.error(error);
      res.json({ status: false });
    }
  });
  
module.exports=router;