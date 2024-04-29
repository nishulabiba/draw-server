const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
//
// //stripe key
// const stripe = require('stripe')(process.env.SECRET_KEY)

//middlewares

app.use(cors());
app.use(express.json())
// middlewares 
const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization || req.headers.Authorization;


    if (!authorization) {
        console.log('No Authorization Header');
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err);
            return res.status(401).send({ message: 'unauthorized access' });
        } else {
            req.decoded = decoded;
            next();
        }
    })
};


//mongodb connect

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.ubbebrm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        //database collection
        const usersCollection = client.db("time2draw").collection("users")
        const instructorsCollection = client.db("time2draw").collection("instructors")
        const classesCollection = client.db("time2draw").collection("classes")


        //JWT GENERATION...
        app.post("/jwt", (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
        })


        app.post("/users", async (req, res) => {

            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                res.send({ message: "User already exists!!!" })
            }
            else {
                const result = await usersCollection.insertOne(user)
                res.send(result)
            }
        })
        app.get("/users", verifyJwt, async (req, res) => {

            //  const user = await usersCollection.findOne(query)
            //  //security level : check admin role
            //  const admin = {admin: user?.role === 'admin' }
            //  console.log(admin.admin);
            //  if(admin.admin == false){
            //    return res.status(401).send({ message: 'forbidden  access' })
            //  }
            const result = await usersCollection.find().toArray()
            res.send(result)
        })


        app.get("/classes", async (req, res) => {

            try {
                const result = await classesCollection.find().sort({ totalStudents: -1 }).toArray()

                res.send(result);
            }
            catch (err) {
                console.error("Error fetching classes:", err);
                res.status(500).send("An error occurred while fetching classes");
            }


        })

        app.get("/instructors", async (req, res) => {

            const result = await instructorsCollection.find().toArray()
            res.send(result)


        })
        app.get("/popularInstructors", async (req, res) => {
            try {
                const instructors = await instructorsCollection.find().toArray()

                const pipeline = [
                    // Group by instructorName and calculate the totalStudents for each instructor
                    {
                        $group: {
                            _id: "$instructorName",
                            totalStudents: { $sum: "$totalStudents" }
                        }
                    },
                    // Sort the instructors based on totalStudents in descending order
                    { $sort: { totalStudents: -1 } }
                ];

                // Execute the aggregation pipeline on the "classes" collection
                const result = await classesCollection.aggregate(pipeline).toArray();
                        // Create a map to store the totalStudents for each instructor
        const totalStudentsMap = {};
        result.forEach(instructor => {
            totalStudentsMap[instructor._id] = instructor.totalStudents;
        });

        // Map the instructors found in the aggregation result to their respective documents
        const instructorsWithTotalStudents = instructors.map(instructor => ({
            ...instructor,
            totalStudents: totalStudentsMap[instructor.Name] || 0 // Set totalStudents to 0 if instructor is not found in the result
        }));

        // Sort the instructors based on their total students in descending order
        instructorsWithTotalStudents.sort((a, b) => b.totalStudents - a.totalStudents);

        res.send(instructorsWithTotalStudents);
            } catch (err) {
                console.error("Error fetching popular instructors:", err);
                res.status(500).send("An error occurred while fetching popular instructors");
            }
        });

        app.get("/instructorClasses/:id",  async(req, res)=>{
            const id = req.params;
            const instructors = await instructorsCollection.find().toArray();
            const classes = await classesCollection.find().toArray();
            const instructor = instructors.find(i=> i._id = id)
            const {ClassNames} = instructor;
            const filteredClasses= classes.filter(i=> {ClassNames.find(t=> t== i.name)})
            res.send(filteredClasses)



        })

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Server is implemented successfully!!!!!!!")
})








app.listen(port, () => {
    console.log(`the server is running on port: ${port}`);
})