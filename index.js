require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.98vvu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const userCollection = client.db("task-handler").collection("users");
    const taskCollection = client.db("task-handler").collection("tasks");
    app.get("/", async (req, res) => {
      res.send("hello world");
    });

    // adding user to db
    app.post("/addUser", async (req, res) => {
      const { uid, email, name } = req.body;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      if (!result) {
        const added = await userCollection.insertOne(req.body);
        res.send(added);
      }
    });

    // adding a task to db
    app.post("/addTask", async (req, res) => {
      try {
        const { title, description, category, email } = req.body;
        const newTask = {
          title,
          description,
          category,
          email,
        };

        // Store in database (MongoDB or any other)
        const result = await taskCollection.insertOne(newTask);
        if (result) {
          res.send(result);
        }
      } catch (err) {
        res.status(500).json({ error: "Failed to add task" });
      }
    });

    app.patch("/updateTask/:id", async (req, res) => {
      const { id } = req.params;
      const { category } = req.body;

      if (!category) {
        return res.status(400).json({ message: "Category is required" });
      }

      try {
        const result = await taskCollection.updateOne(
          { _id: new ObjectId(id) }, // Ensure correct task is updated
          { $set: { category } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({ message: "Task updated successfully" });
        } else {
          res.status(404).json({ message: "Task not found" });
        }
      } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // getting
    app.get("/getTasks", async (req, res) => {
      const email = req.query.email;
      try {
        const tasks = await taskCollection.find({ email: email }).toArray();
        res.status(200).json(tasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // delete a task
    app.delete("/deleteTask/:id", async (req, res) => {
      try {
        const result = await taskCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
