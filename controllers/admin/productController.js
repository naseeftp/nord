const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const User=require("../../models/userSchema");
const fs=require("fs");
const path=require("path");
const sharp=require("sharp");
// const { search } = require("../../routes/adminRouter");

const getProductAddPage=async (req,res)=>{
try {
    const category=await Category.find({isListed:true})
     const brand=await Brand.find({isBloocked:false})
     res.render('product-add',{
cat:category,
brand:brand
});
}
catch (error) 
{
     res.redirect("/pageerror")
}
}


const addProducts = async (req, res) => {
    try {
        const products = req.body;
        if (!products.productName) {
            return res.status(400).json({ 
                swalError: true,
                message: "Product Name is required"
            });
        }
        const productExists = await Product.findOne({
            productName: { $regex: new RegExp(`${products.productName}$`, 'i') }
        });

        if (productExists) {
            return res.status(400).json({
                swalError: true,
                message: "Product already exists. Please try again with another name."
            });
        }

      
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                swalError: true,
                message: "Please upload at least one image."
            });
        }

    
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        for (const file of req.files) {
            if (!allowedMimeTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    swalError: true,
                    message: `Invalid file type for ${file.originalname}. Only JPEG, JPG, PNG, or WEBP images are allowed.`
                });
            }
        }

       
        const images = [];
        for (const file of req.files) {
            const originalImagePath = file.path;
            const resizedImagePath = path.join(
                "public",
                "uploads",
                "product-images",
                file.filename
            );

            await sharp(originalImagePath)
                .resize({ width: 400, height: 440 })
                .toFile(resizedImagePath);

            images.push(file.filename);
        }

     
        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).json({
                swalError: true,
                message: "Invalid category selected."
            });
        }

       const regularPrice=parseFloat(products.regularPrice);
       let salePrice=regularPrice;

        const categoryOffer=categoryId.categoryoffer||0;
        const productOffer=0;

        const higherOffer=Math.max(categoryOffer,productOffer);

      
        if(higherOffer>0){
        salePrice=regularPrice-Math.floor(regularPrice*(higherOffer/100));
       }
      
       if(categoryId.categoryoffer&&categoryId.categoryoffer>0){
        salePrice=regularPrice*(1-(categoryId.categoryoffer/100));
      }

      if(products.salePrice&&parseFloat(products.salePrice)<salePrice){
        salePrice=parseFloat(products.salePrice)
      }

        const sizes = [];
        if (products.sizeQuantity && typeof products.sizeQuantity === "object") {
            for (const [size, quantity] of Object.entries(products.sizeQuantity)) {
                const qty = parseInt(quantity, 10) || 0;
                if (qty > 0) {
                    sizes.push({ size, quantity: qty });
                }
            }
        }

   
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: regularPrice,
            salePrice: salePrice,
            createdOn: new Date(),
            sizes: sizes,
            color: products.color,
            productImage: images,
            status: 'Available',
            categoryoffer: categoryOffer,
            productOffer: productOffer,
            finalPrice:salePrice
        });

        await newProduct.save();

        return res.json({
            success: true,
            message: "Product added successfully!"
        });

    } catch (error) {
        console.error("Error saving product:", error);
        return res.status(500).json({
            swalError: true,
            message: "An error occurred while saving the product. Please try again."
        });
    }
};



const getAllProducts=async(req,res)=>{
try {
    const search=req.query.search|| "";
    const page=req.query.page|| 1;
    const limit=4;
    const productData=await Product.find({
    $or:[
    {productName:{$regex:new RegExp(".*"+search+".*","i")}},
    {brand:{$regex:new RegExp(".*"+search+".*","i")}},

    ],

    }).limit(limit*1).skip((page-1)*limit).populate({
        path: 'category',
        select: 'name', 
        options: { lean: true } 
    }).exec();
    const filteredProducts = productData.filter(product => product.category !== null);
    const count= await Product.find({
    $or:[
     {productName:{$regex:new RegExp(".*"+search+".*","i")}},
     {brand:{$regex:new RegExp(".*"+search+".*","i")}}


    ],

    }).countDocuments();

   const category=await Category.find ({isListed:true});
   const brand=await Brand.find({isBloocked:false});
   if(category&&brand){
    res.render("products",{
    data: filteredProducts.length > 0 ? filteredProducts : productData,
     currentPage:page,
     totalPages:page,
     totalPages:Math.ceil(count/limit),
     cat:category,
     brand:brand,

    })
   }
   else{
    res.redirect("page-404");

 }
} catch (error) {
    res.redirect("/pageerror");
}
}

const  blockProduct= async(req,res)=>{
try {
let id=req.query.id;
await Product.updateOne({_id:id},{$set:{isBlocked:true}});
   res.redirect('/admin/products') ;
} catch (error) {
    res.redirect('/pageerror');
}

}

const  unblockProduct= async(req,res)=>{
    try {
    let id=req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:false}});
       res.redirect('/admin/products') ;
    } catch (error) {
        res.redirect('/pageerror');
    }
    
    }

    const getEditProduct=async (req,res)=>{
        try {
        const id=req.query.id;
        const product=await Product.findOne({_id:id});
        const category=await Category.find({});
        const brand=await Brand.find({});
        res.render('edit-product',{
         product:product,
         cat:category,
         brand:brand,
   
   
        })
        } catch (error) {
           res.redirect("/pageerror")
        }
   
   
       }
   


const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;
        const existingProduct = await Product.findOne({
           productName: { $regex: new RegExp(`^${data.productName}$`, 'i') },
           _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({
                swalError: true,
                message: "Product with this name already exists. Please try another name."
            });
        }

        if (req.files && req.files.length > 0) {
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
            for (const file of req.files) {
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return res.status(400).json({
                        swalError: true,
                        message: `Invalid file type for ${file.originalname}. Only JPEG, PNG, or WEBP images are allowed.`
                    });
                }
            }
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const originalImagePath = file.path;
                const resizedImagePath = path.join(
                    "public",
                    "uploads",
                    "product-images",
                    file.filename
                );
                await sharp(originalImagePath)
                    .resize({ width: 400, height: 440 })
                    .toFile(resizedImagePath);
                images.push(file.filename);
            }
        }

        let sizes = [];
        if (data.sizesWithQuantities) {
            const sizesWithQuantities = JSON.parse(data.sizesWithQuantities);
            sizes = Object.keys(sizesWithQuantities).map(size => ({
                size: size,
                quantity: sizesWithQuantities[size]
            }));
        }

        const newCategory = await Category.findOne({ name: data.category });
        if (!newCategory) {
            return res.status(400).json({
                swalError: true,
                message: "Invalid category selected"
            });
        }

        const currentProduct = await Product.findById(id);
        const isCategoryChanged = !currentProduct.category.equals(newCategory._id);
        const regularPrice = parseFloat(data.regularPrice);
        
        const categoryOffer = newCategory.categoryoffer || 0;
        const productOffer = currentProduct.productOffer || 0;
        const higherOffer = Math.max(categoryOffer, productOffer);
        
        let salePrice = regularPrice;  
        let finalPrice = regularPrice;
        
        if (higherOffer > 0) {
            finalPrice = regularPrice - Math.floor(regularPrice * (higherOffer / 100));
            salePrice = finalPrice;
        }

        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand,
            category: newCategory._id,
            regularPrice: regularPrice,
            salePrice: salePrice,
            color: data.color,
            sizes: sizes,
            categoryoffer: categoryOffer, 
            productOffer: productOffer, 
            finalPrice: finalPrice
        };

        if (images.length > 0) {
            updateFields.$push = { productImage: { $each: images } };
        }

        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
           swalError: true,
           message: "An error occurred while updating the product" 
        });
    }
};

const deleteSingleImage=async(req,res)=>{
  try {
    const {imageNameToServer,productIdToServer}=req.body;
    const product=await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}})
    const imagePath=path.join("public","uploadds","re-image",imageNameToServer);
    if(fs.existsSync(imagePath)){
    await fs.unlinkSync(imagePath);
    console.log(`Image ${imageNameToServer} deleted succesfully`);

    }
    else{

        console.log(`image ${imageNameToServer} not found`)
    }
    res.send({status:true});

  } catch (error) {
    res.redirect('/pageerror')
  }

  }



module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage


}

