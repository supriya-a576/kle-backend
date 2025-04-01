const express=require('express');
const app=express();
const mongoose = require('mongoose');
const {User}=require('./model/User');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const cors=require('cors');
const morgan=require('morgan');
const {Product}=require('./model/Product');
const {Cart}=require('./model/Cart');


//middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());


let MONGODB_URL="mongodb+srv://supriyayummanagoudra:8Vt3BcZuRrKvF8e8@cluster0.mg0jtan.mongodb.net/?retryWrites=true&w=majority"
mongoose.connect(MONGODB_URL)
.then(()=>{
    console.log('db connected');
}).catch((err)=>{
    console.log('db is not connected');

})


  //task-1 create a route for register user
app.post('/register',async(req,res)=>{
    try{
        let {email,name,password} = req.body;
        if(!email || !name ||!password){
            return res.status(400).json({message:"Some fields are Missing"})
        }
        let isUserAlreadyExist = await User.findOne({email});
        if(isUserAlreadyExist){
            return res.status(400).json({message:"User already has a account"});
        }else{
            //hash the password
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(password,salt);

            //token
            const token = jwt.sign({email},"supersecret",
                {expiresIn:'365d'});

            await User.create({
                name,
                email,
                password:hashedPassword,
                token,
                role:'user'
            })
        return res.status(201).json({message:"User created Successfully"})
        }
    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})


//task-2 create a route for login user
app.post('/login',async(req,res)=>{
    try{
        let {email,password} = req.body;

        if(!email || !password){
            return res.status(400).json({message:"Email and password are required"})
        }
        const user = await User.findOne({email});
        if(!user){
            return res.status(400).json({message:"User is not registered, Please create Account"})
        }
        //check password
        const isPasswordMatched = bcrypt.compareSync(password,user.password);

        if(!isPasswordMatched){
            return res.status(400).json({message:"invalid Password"})
        }

        //successful login
        return res.status(200).json({
            id:user._id,
            name:user.name,
            token: user.token,
            email: user.email,
            role:user.role
        })


    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})

//task-3 -> create route see all the product
app.get('/products',async(req,res)=>{
    try{
        const products = await Product.find();
        res.status(200).json({
            message:"Product found successfully",
            products:products
        })

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})

//task-4-> create a route to add product
app.post('/add-product',async(req,res)=>{
    try{

        const {name, image, price, description,stock,brand} = req.body;
        const {token} = req.headers;
        const decodedtoken = jwt.verify(token,"supersecret");
        const user = await User.findOne({email:decodedtoken.email});
        const product = await Product.create({
            name,
            description,
            image,
            price, 
            stock,
            brand,
            user:user._id
        })
        return res.status(201).json({
            message:"Product created successfully",
            product:product
        })

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})


//task5 -> to show the particular product
app.get('/product/:id', async(req,res)=>{
    try{
        const {id} = req.params;
        if(!id){
            res.status(400).json({message:"Product Id not found"});
        }

        const {token} = req.headers;

        const userEmailFromToken = jwt.verify(token,"supersecret");
        if(userEmailFromToken.email){
            const product = await Product.findById(id);

            if(!product){
                res.status(400).json({message:"Product not found"});
            }

            res.status(200).json({message:"success",product});
        }

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
})

//task-6 update a product
app.patch('/product/edit/:id',async(req,res)=>{
 const {id} = req.params;
 const {token} = req.headers;
 const {name, image, price, stock, brand, description} = req.body.productData;
 const decodedtoken = jwt.verify(token, "supersecret");
 try{
    if(decodedtoken.email){
        const updatedProduct = await Product.findByIdAndUpdate(id,{
           name,
           description,
           image,
           price,
           brand,
           stock 
        })
        return res.status(200).json({
            message:"product updated successfully",
            product: updatedProduct
        })
    }
 }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})

//task-7 delete the product
app.delete('/product/delete/:id',async(req,res)=>{
    const {id}  = req.params;
    if(!id){
        return res.status(400).json({message:"Product id not found"});
    }
    try{
        const deletedProduct = await Product.findByIdAndDelete(id);

        if(!deletedProduct){
            return res.status(404).json({message:"Product not found"})
        }

        return res.status(500).json({
            message:"Product deleted succcessfuly",
            product: deletedProduct
        })

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})

//task-8 create the route to see the products in cart
app.get('/cart',async(req,res)=>{
    try{
        let{token}=req.headers;
        let decodedtoken=jwt.verify(token,'supersecret')
        const user=await User.findOne({email:decodedtoken.email}).populate({
            path:'cart',
            populate:{
                path:'products',
                model:'Product'
            }
            })
            if(!user){
                return res.status(400).json({
                    message:"user not found"
                })
            }
            return res.status(200).json({
                cart:user.cart
            })
        }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})
//task-9 create route to add product in cart
app.post('/cart/add',async(req,res)=>{
    try{
        const body=req.body;
        //getting product id from frontend;
        const productArray=body.products;
        let totalPrice=0;

        //find the product and add the product price in total
        for(let item of productArray){
            const product=await Product.findById(item);
            if(product){
                totalPrice += product.price;
            }
            
            
        }
         // find the user
         let {token}=req.headers;
         let decodedtoken=jwt.verify(token,"supersecret");
         const user=await User.findOne({email:decodedtoken.email});
         if(!user){
            return res.status(400).json({
                message:"User not found"
            })
         }
         //checking if user already has a cart
         let cart;
         if(user.cart){
            cart=await Cart.findById(user.cart).populate('products');
            //extracting product id's from the existing cart
            const existingProductIds=cart.products.map((product)=>{
                product._id.toString()
            })
            //looping through the newly added produts
            //if product is not already in the cart add it to cart
            productArray.forEach(async(productId)=>{
                if(!existingProductIds.includes(productId)){
                    cart.products.push(productId);
                    const product=await Product.findById(productId);
                    totalPrice += product.price;
                }
            })
            //updating cart total
            //saving cart
            cart.total=totalPrice;
            await cart.save();
         }else{
            cart= new Cart({
                products:productArray,
                total:totalPrice

            })
            await cart.save();
            user.cart=cart._id;
            await user.save();
        }
           
        return res.status(400).json({
            message:"cart updated successfully",
            cart:cart
        })
        
            
        
        

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})
//create the route to delete-product in cart
app.delete('/cart/product/delete',async(req,res)=>{
    try{
        const {productID}=req.body;
        const {token}=req.headers;
        const decodedtoken=jwt.verify(token,"supersecret");
        const user=await User.findOne({email:decodedtoken.email}).populate('cart');
        if(!user){
            return res.status(400).json({
                message:"user not found"
            })
        }
        const cart=await Cart.findById(user.cart).populate('products');
        if(!cart){
            return res.status(400).json({
                messege:"cart not found"
            })
        }
        //findIndex() searches for the product in cart
        const productIndex=cart.products.findIndex(
            (product)=>product._id.toString()===productID
            
        );
        if(productIndex === -1){
            return res.status(404).json({
                message:"product not found in cart"
            })
        }
        cart.products.splice(productIndex,1);
        cart.total=cart.products.reduce(
            (total,product)=>total+product.price,
             0
            
        )
        await cart.save();
        return res.status(200).json({
            message:"product removed from cart successfully",
            cart:cart
        })

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})

let PORT=8080;
app.listen(PORT,()=>{
    console.log(`server is connected to code ${PORT}`)
})