const Wallet=require('../../models/walletSchema');
const User=require('../../models/userSchema');
const { timingSafeEqual } = require('crypto');
const { title } = require('process');
const { v4: uuidv4 } = require("uuid");
const Transaction= require('../../models/transactionSchema')

const getAllTransactions=async(req,res)=>{
try {
    const page=Number.parseInt(req.query.page)||1;
    const limit=10;
    const skip=(page-1)*1;


const transactions=await Transaction.find()
.populate("userId","name email")
.sort({createdAt:-1})
.skip(skip)
.limit(limit)

const totalTransactions=await Transaction.countDocuments()

  const uniqueUsers= await User.find()
  const  totalPages=Math.ceil(totalTransactions/limit)
  res.render("transactions",{
  transactions,
  currentPage:page,
  totalPages,
  totalTransactions,
  query:req.query,
  users:uniqueUsers,
  title:"Transaction Management",

})

} catch (error) {
    console.error("error in fetching transactions",error);
    res.status(500).send("internal server error")

}
};

const getTransactionsDetails=async(req,res)=>{
  try {
    const {transactionId}=req.params
    const transaction=await Transaction.findOne({transactionId}).populate("userId","name email phone")
    console.log("Transaction Data:", transaction);
    if(!transaction){
      console.log("Transaction Data:", transaction);
      return res.redirect("/admin/transactions")
    }

    res.render("transactiondetails",{
    transaction,
    user:transaction.userId,
    title:"Transaction Details",

    })

  } catch (error) {
    console.error("error while fetching transaction details",error)
     res.status(500).send("internal server error")
  }


}




module.exports={
    getAllTransactions,
    getTransactionsDetails
}