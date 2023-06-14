const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('summer camp school photography learning...')
})

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorize access' })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorize access' })
        }
        req.decoded = decoded
        next();

    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ohczye1.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // await client.connect();

        // all collection
        const usersCollection = client.db('photography').collection('users');
        const instructorCollection = client.db('photography').collection('addClass');
        const selectedClassCollection = client.db('photography').collection('selectedClass')
        const paymentsCollection = client.db('photography').collection('payments')


        // json web token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '2hr'
            })
            res.send({ token })

        })

        // selected class api
        app.get('/selectedClass', async (req, res) => {
            const result = await selectedClassCollection.find().toArray();
            res.send(result);
        })

        app.get('/selectedClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedClassCollection.findOne(query);
            res.send(result);
        })

        app.post('/selectedClass', async (req, res) => {
            const selectClass = req.body;
            const result = await selectedClassCollection.insertOne(selectClass);
            res.send(result);
        })

        app.delete('/selectedClass/:id', async (req, res) => {
            const id = req.params;
            const query = {_id: new ObjectId(id)}
            const result = await selectedClassCollection.deleteOne(query)
            res.send(result);

        })

        // manage Class
        app.patch('/addClass/approved/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'approved'
                }
            }
            const result = await instructorCollection.updateOne(filter, updateDoc)
            res.send(result)

        })

        app.patch('/addClass/denied/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'denied'
                }
            }
            const result = await instructorCollection.updateOne(filter, updateDoc)
            res.send(result)

        })

        app.post('/addClass/feedback', async (req, res) => {
            const feedback = req.body;
            console.log(feedback);
            const result = await instructorCollection.insertOne(feedback);
            res.send(result);
        })


        // add class api
        app.get('/instructor', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await instructorCollection.find(query).toArray();
            res.send(result);

        })
        app.get('/addClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await instructorCollection.findOne(query);
            res.send(result);
        })

        app.get('/addClass', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result);
        })

        app.post('/addClass', async (req, res) => {
            const newClass = req.body;
            const result = await instructorCollection.insertOne(newClass);
            res.send(result);

        })



        // manage users api

        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.send({ admin: false })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.send({ instructor: false })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);

        })


        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        // create-payment-intent
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],

            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // payment related api
        app.get('/payments', async (req, res) => {
            const result = await paymentsCollection.find().toArray();
            res.send(result);
        })
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const query = req.price;
            const deleteResult = await selectedClassCollection.deleteOne(query)
            res.send({ result, deleteResult });
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})