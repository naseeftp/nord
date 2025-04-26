const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")
const productController =require("../controllers/admin/productController")
const orderController=require("../controllers/admin/orderController")
const offerController=require("../controllers/admin/offerController")
const couponController=require("../controllers/admin/couponController")
const salesController = require('../controllers/admin/salesController');
const{userAuth,adminAuth}=require("../middlewares/auth");
const multer=require("multer");
const uploads=require("../helpers/multer")
// const uploads=multer({storage:storage})
const transactionController=require("../controllers/admin/transactionController")


router.get("/pageerror",adminController.pageerror)

//loginmanagement
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard);
router.get('/dashboard', adminAuth, adminController.loadDashboard)
router.get("/logout",adminController.logout)

//customermanagement
router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)

//categorymangement
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);

//product management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);
router.get('/blockProduct',adminAuth,productController.blockProduct);
router.get('/unblockProduct',adminAuth,productController.unblockProduct);
router.get('/editProduct',adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);
router.post('/deleteImage',adminAuth,productController.deleteSingleImage);

//order management
router.get('/orderList',adminAuth,orderController.getOrderListPageAdmin)
router.get('/orders/:orderId',adminAuth,orderController.getOrderDetailsPageAdmin)
router.post('/update-status/:orderId',adminAuth, orderController.updateOrderStatus)
router.post('/update-item-status',adminAuth, orderController.updateItemStatus)


//offermanagement
router.post('/addProductOffer',adminAuth,offerController.addProductOffer);
router.post('/removeProductOffer',adminAuth,offerController.removeProductOffer)
router.post("/addCategoryOffer",adminAuth,offerController.addCategoryOffer);
router.post("/removeCategoryOffer",adminAuth,offerController. removeCategoryOffer);

//coupenmanagement
router.get('/coupon',adminAuth,couponController.loadCoupon);
router.post('/createCoupon',adminAuth,couponController.createCoupon);
router.get("/editCoupon",adminAuth,couponController.editCoupon);
router.post("/updateCoupon",adminAuth,couponController.updateCoupon);
router.get('/deletecoupon',adminAuth,couponController.deleteCoupon)

// dashboard management
router.get("/sales/report",salesController.loadSalesPage);
router.get('/sales', adminAuth, salesController.loadSalesPage);

router.get('/sales-report', salesController.loadSalesPage);



router.get("/checkCouponName", async (req, res) => {
    try {
      const couponName = req.query.name.trim().toLowerCase();
      const existingCoupon = await Coupon.findOne({ name: { $regex: `^${couponName}$`, $options: "i" } });
  
      if (existingCoupon) {
        return res.json({ exists: true });
      } else {
        return res.json({ exists: false });
      }
    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });


  //transaction
  router.get('/transactions',adminAuth,transactionController.getAllTransactions)
  router.get("/transactions/:transactionId", adminAuth,transactionController.getTransactionsDetails)
  router.get("/api/sales-data", adminAuth, adminController.getSalesData)
  
  router.post('/handle-item-return',adminAuth,orderController.handleItemReturn)




module.exports=router