const Category=require("../../models/categorySchema")



const categoryInfo=async (req,res)=>{
try {
    const page=parseInt(req.query.page)||1;
    const limit=4;
    const skip=(page-1)*limit;
    const categoryData=await Category.find({})
    .sort({createdAt:-1})
    .skip(skip)
    .limit(limit)
    const totalCategories=await Category.countDocuments();
    const totalPages=Math.ceil(totalCategories/limit);
    res.render("category",{
        cat:categoryData,
        currentPage:page,
        totalPages:totalPages,
        totalCategories:totalCategories
    })
} catch (error) {
    console.error(error);
    res.redirect("/pageerror")
}
}

const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
      
      const existingCategory = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });

      if (existingCategory) {
        return res.status(400).json({ error: "Category already exists" });
      }
  
      const newCategory = new Category({
        name,
        description
      });
      await newCategory.save();
  
      return res.json({ message: "Category added successfully" });
    } catch (error) {
      console.error("Error adding category:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

const getListCategory=async(req,res)=>{
try {
  let id=req.query.id;
  await Category.updateOne({_id:id},{$set:{isListed:false}})
  res.redirect("/admin/category");
} catch (error) {
  res.redirect("/pageerror")
}

}

const getUnlistCategory=async(req,res)=>{
  try {
    let id=req.query.id;
  await Category.updateOne({_id:id},{$set:{isListed:true}});
  res.redirect("/admin/category");

  } catch (error) {
    res.redirect("/pageerror")
  }
  
  }

  const getEditCategory=async(req,res)=>{
    try {
      const id=req.query.id;
       const category=await Category.findOne({_id:id});
       res.render("edit-category",{category:category});
     
    } catch (error) {
      res.redirect("/pageerror")
    }
    
    };





const editCategory = async (req, res) => {
  try {
      const id = req.params.id;
      let { categoryName, description } = req.body;

      if (typeof categoryName === 'undefined' && req.headers['content-type'] === 'application/x-www-form-urlencoded') {
          const body = require('querystring').parse(req.body);
          categoryName = body.categoryName;
          description = body.description;
      }

     
      const existingCategory = await Category.findOne({
          name: { $regex: new RegExp(`^${categoryName}$`, 'i') },
          _id: { $ne: id }
      });

      if (existingCategory) {
          return res.status(400).json({
              success: false,
              message: "Category already exists. Please choose another name."
          });
      }

      const updateCategory = await Category.findByIdAndUpdate(
          id,
          { name: categoryName, description },
          { new: true, runValidators: true }
      );

      if (!updateCategory) {
          return res.status(404).json({
              success: false,
              message: "Category not found"
          });
      }

      return res.json({
          success: true,
          message: "Category updated successfully"
      });

  } catch (error) {
      console.error("Error updating category:", error);
      return res.status(500).json({
          success: false,
          message: "Internal server error"
      });
  }
};


module.exports={
categoryInfo,
addCategory,

getListCategory,
getUnlistCategory,

getEditCategory,
editCategory


}