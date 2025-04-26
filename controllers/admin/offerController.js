const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const User=require("../../models/userSchema");

const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: categoryId });
    await Category.updateOne({ _id: categoryId }, { $set: { categoryoffer: percentage } });

    for (const product of products) {
      const higherOffer = Math.max(percentage,product.productOffer)
      product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (higherOffer/100))
      await product.save()
    }

    res.json({ status: true, message: "Category offer added successfully." });
  } catch (error) {
    console.error("Error adding category offer:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};


const removeCategoryOffer=async(req,res)=>{
  try {
      const categoryId=req.body.categoryId;
      const category = await Category.findById(categoryId);
      if(!category){
          return res.status(400).json({status:false,message:"categoryy not found"})
      }

      category.categoryoffer = 0
      const products = await Product.find({category:categoryId});
      for(const product of products){
        const productOffer = product.productOffer
        product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (productOffer/100))
        await product.save()
      }
  
      await category.save()
      res.json({status:true})

  } catch (error) {
      res.status(500).json({status:false,message:"internal servar error"})
  }
}

const addProductOffer=async(req,res)=>{
try {
    const {productId, percentage} = req.body
    const findProduct = await Product.findOne({_id:productId})
    const findCategory = await Category.findOne({_id:findProduct.category})
    const higherOffer = Math.max(findCategory.categoryoffer, parseInt(percentage))
    findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (higherOffer/100))
    findProduct.productOffer = parseInt(percentage)
    await findProduct.save()
    res.json({status:true})
} catch (error) {
    res.redirect("/pageerror");
    res.status(500).json({status:false,message:"internal server error"})
}
}

const removeProductOffer=async(req,res)=>{
    try {
        const {productId} = req.body
        const findProduct = await Product.findOne({_id:productId});
        const findCategory = await Category.findOne({_id:findProduct.category}) 
        const categoryOffer = findCategory.categoryoffer || 0
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice*(categoryOffer/100))
        findProduct.productOffer = 0
        await findProduct.save();
        res.json({status:true});

    } catch (error) {
        res.redirect('/pageerror')
    }
}

module.exports={
    addProductOffer,
    removeProductOffer,
    addCategoryOffer,
    removeCategoryOffer,
}