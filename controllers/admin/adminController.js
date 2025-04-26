const User = require("../../models/userSchema");
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Category = require("../../models/categorySchema");


const pageerror=async(req,res)=>{
  res.render("admin-error")
}

const loadLogin=(req,res)=>{
 if(req.session.admin){

    return res.redirect("/admin/dashboard")
 }
 res.render("admin-login",{message:null})

}


const logout=async(req,res)=>{
  try {
    req.session.admin = undefined
     return res.redirect("/admin/login")
  
  } catch (error) {
    console.log(("un expected error  during logout",error))
    res.redirect("/pageerror")
  }
  }
  

const login=async(req,res)=>{
try {
    const {email,password}=req.body;
    const admin=await User.findOne({email,isAdmin:true})
    if(admin){
        const passwordMatch=await bcrypt.compare(password, admin.password);
        if(passwordMatch){
            req.session.admin=true;
            return res.redirect("/admin");
        }
        else{

            return res.render('admin-login', {message: 'Invalid credentials!'})
        }
    }
    else{
      return res.render('admin-login', {message: 'Invalid credentials'})
    }

} catch (error) {
    console.log("login error",error)
    return res.redirect("/admin/pageerror");
}
}



const loadDashboard = async (req, res) => {
  try {
    
    const [productCount, userCount, orderCount] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments({ isAdmin: false }),
      Order.countDocuments()
    ]);

    const deliveredOrders = await Order.find({ status: "Delivered" });
    const totalRevenue = deliveredOrders.reduce((total, order) => total + order.finalAmount, 0);

    const [topProducts,topCategories,recentOrders, salesData, statusCounts] = await Promise.all([
      getTopSellingProducts(),
      getTopSellingCategories(),
      getRecentOrders(),
      getSalesDataHelper("monthly"),
      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ])
    ]);

    const statusDistribution = {
      'Pending': 0,
      'Processing': 0,
      'Shipped': 0,
      'Delivered': 0,
      'Cancelled': 0,
      "Return Requested": 0,
      "Return Approved": 0,
      "Return Rejected": 0,
     
      
    };

    statusCounts.forEach(({ _id, count }) => {
      statusDistribution[_id] = count;
    });

    const statusChartData = {
      labels: Object.keys(statusDistribution),
      counts: Object.values(statusDistribution),
      colors: [
       "#FFCE56", 
        "#36A2EB", 
        "#FF6384",
        "#4BC0C0", 
        "#FF9F40", 
        "#9966FF", 
        "#00C4B4", 
        "#FF6B6B", 
      ]
    };

  
    const dashboardData = {
      productCount,
      userCount,
      orderCount,
      totalRevenue,
      topProducts: topProducts || [],
      topCategories:topCategories||[],
      recentOrders: recentOrders || [],
      salesData: salesData.data || [],
      salesLabels: salesData.labels || [],
      statusDistribution,
      statusChartData 
    };

    res.render("dashboard", { dashboardData });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.redirect("/admin/pageerror");
  }
};

const getTopSellingProducts = async (limit = 5) => {
  try {
    const deliveredproduct=await Order.countDocuments({status:"Delivered"});


    const topProducts = await Order.aggregate([
      {$match:{status:"Delivered"}},
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          name: { $first: "$orderItems.productName" },
          soldCount: { $sum: "$orderItems.quantity" },
          totalSales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
        },
      },
      { $sort: { soldCount: -1 } },
      { $limit: limit },
    ])
      
 
    const enrichedProducts = await Promise.all(
      topProducts.map(async (product) => {
        const productDetails = await Product.findById(product._id).populate("category")
        return {
          _id: product._id,
          name:productDetails?.productName||product.productName||"unknown product",
          productName:product.productName,
          category: productDetails?.category?.name || "Uncategorized",
          price: productDetails?.salePrice || 0,
          image: productDetails?.productImage?.[0] ?`/uploads/re-image/${productDetails.productImage[0]}` : null,
          soldCount: product.soldCount,
        }
      }),
    )

    return enrichedProducts.filter(product=>product!==null)
  } catch (error) {
    console.error("Error getting top products:", error)
    return []
  }

}

const getRecentOrders = async (limit = 5) => {
  try {
    const recentOrders = await Order.find().sort({ createdOn: -1 }).limit(limit)

    
    const ordersWithCustomers = await Promise.all(
      recentOrders.map(async (order) => {
        const customer = await User.findById(order.userId)
        return {
          ...order.toObject(),
          customerName: customer ? `${customer.name} ${customer.email}` : "Unknown",
        }
      }),
    )

    return ordersWithCustomers
  } catch (error) {
    console.error("Error getting recent orders:", error)
    return []
  }
}



const getSalesDataHelper = async (period = "yearly") => {
  try {
    const now = new Date();
    let startDate, endDate = new Date();
    let groupBy, labels;

    switch (period) {
        case 'weekly':
            startDate = new Date(now.setDate(now.getDate() - 7));
            labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            groupBy = { $dayOfWeek: "$createdOn" };
            break;
        case 'monthly':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const daysInMonth = endDate.getDate();
            labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
            groupBy = { $dayOfMonth: "$createdOn" };
            break;
        case 'yearly':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            groupBy = { $month: "$createdOn" };
            break;
        default:
            throw new Error('Invalid period specified');
    }

    const sales = await Order.aggregate([
        {
            $match: {
                createdOn: { $gte: startDate, $lte: endDate },
                status: { $in: ['Delivered', 'Processing', 'Shipped'] }
            }
        },
        {
            $group: {
                _id: groupBy,
                total: { $sum: "$finalAmount" }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    const data = Array(labels.length).fill(0);
    
    
    sales.forEach(item => {
   
        const index = item._id - 1;
        if (index >= 0 && index < data.length) {
            data[index] = item.total;
        }
    });

    return {
        data,
        labels
    };

} catch (error) {
    console.error('Error in getSalesDataHelper:', error);
    
    return {
        data: [],
        labels: []
    };
}


}

const getTopSellingCategories = async (limit = 5) => {
  try {
    const topCategories = await Order.aggregate([
      { $match: { status: "Delivered" } },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          soldCount: { $sum: "$orderItems.quantity" },
          totalSales: { 
            $sum: { 
              $multiply: ["$orderItems.price", "$orderItems.quantity"] 
            } 
          }
        }
      },
      { $sort: { soldCount: -1 } },
      { $limit: limit }
    ]);

    const categories = await Promise.all(
      topCategories.map(async (cat) => {
        const categoryDoc = await Category.findById(cat._id);
        const productCount = await Product.countDocuments({ category: cat._id });
        
        return {
          _id: cat._id,
          name: categoryDoc?.name || "Uncategorized",
          soldCount: cat.soldCount,
          totalSales: cat.totalSales || 0,
          productCount: productCount
        };
      })
    );

    return categories;
  } catch (error) {
    console.error("Error in getting top categories", error);
    return [];
  }
};

 
const getSalesData = async (req, res) => {
  try {
    const { period = "monthly" } = req.query

    const salesData = await getSalesDataHelper(period)
    res.json(salesData)
  } catch (error) {
    console.error("Error in getSalesData API:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}


module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getTopSellingProducts ,
    getRecentOrders,
    getSalesDataHelper,
    getSalesData,
    getTopSellingCategories,
    
}