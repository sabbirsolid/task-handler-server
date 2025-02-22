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
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
    const userCollection = client.db("task-handler").collection("users");
    const taskCollection = client.db("task-handler").collection("tasks");
    const historyCollection = client.db("task-handler").collection("histories");

    // Get tasks for a specific user
    app.get("/getTasks", async (req, res) => {
      const email = req.query.email;
      try {
        const tasks = await taskCollection.find({ email: email }).toArray();
        res.status(200).json(tasks);
      } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    // get history
    app.get("/getHistory/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const history = await historyCollection
          .find({ email })
          .sort({ timestamp: -1 })
          .limit(15)
          .toArray();

        res.status(200).json(history);
      } catch (error) {
       
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // adding user to db
    app.post("/addUser", async (req, res) => {
      const { email } = req.body;

      const query = { email: email };
      const result = await userCollection.findOne(query);
      if (!result) {
        const added = await userCollection.insertOne(req.body);
        res.send(added);
      }
    });

    // adding a task
    app.post("/addTask", async (req, res) => {
      try {
        const { title, description, category, deadline, email } = req.body;

        // Find the maximum position for tasks in the same category and email
        const maxPositionTask = await taskCollection
          .find({ email, category })
          .sort({ position: -1 })
          .limit(1)
          .toArray();

        // Calculate the new position
        const maxPosition =
          maxPositionTask.length > 0 ? maxPositionTask[0].position : -1;
        const newPosition = maxPosition + 1;
        const newTask = {
          title,
          description,
          category,
          email,
          deadline,
          position: newPosition,
          addedTime: new Date(),
          modifiedTime: null,
        };

        // Insert the new task into the database
        const result = await taskCollection.insertOne(newTask);
        // history
        await historyCollection.insertOne({
          action: "add",
          taskId: result.insertedId,
          email,
          timestamp: new Date(),
          details: { title, description, category, deadline },
        });
        if (result) {
          res.send(result);
        }
      } catch (err) {
       
        res.status(500).json({ error: "Failed to add task" });
      }
    });

    // Update task category and position
    app.patch("/updateTask/:id", async (req, res) => {
      const { id } = req.params;
      const { category, position, email } = req.body;

      if (!category) {
        return res.status(400).json({ message: "Category is required" });
      }

      const result = await taskCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { category, position, email, modifiedTime: new Date() } }
      );

      // history collections
      if (result.modifiedCount > 0) {
        await historyCollection.insertOne({
          action: "update",
          taskId: new ObjectId(id),
          email: req.body.email,
          timestamp: new Date(),
          details: { category, position },
        });
      }
      res.send(result);
    });

    // name description cate update
    app.patch("/updateTaskInfo/:id", async (req, res) => {
      const { id } = req.params;
      const { title, description, category, email } = req.body;
      if (!title || !description)
        return res.status(400).send({ error: "All fields are required" });

      const result = await taskCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { title, description, category, modifiedTime: new Date() } }
      );

      if (result.modifiedCount > 0) {
        await historyCollection.insertOne({
          action: "edit",
          taskId: new ObjectId(id),
          email,
          timestamp: new Date(),
          details: { title, description, category },
        });
      }
      res.send(result);
    });

    // Reorder tasks within a category
    app.patch("/reorderTasks", async (req, res) => {
      const { email, category, tasks } = req.body;
      try {
        const bulkOps = tasks.map((task, index) => ({
          updateOne: {
            filter: { _id: new ObjectId(task._id), email },
            update: { $set: { position: index, modifiedTime: new Date() } },
          },
        }));

        await taskCollection.bulkWrite(bulkOps);

        // Log the action in history
        await historyCollection.insertOne({
          action: "reorder",
          email,
          timestamp: new Date(),
          details: { category },
        });
        res.status(200).json({ message: "Tasks reordered successfully" });
      } catch (error) {
        
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // delete a task
    app.delete("/deleteTask/:id", async (req, res) => {
      const task = await taskCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      try {
        const result = await taskCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        // Log the action in history
        if (result.deletedCount > 0) {
          await historyCollection.insertOne({
            action: "delete",
            taskId: new ObjectId(req.params.id),
            email: task.email,
            timestamp: new Date(),
            details: { title: task.title, category: task.category },
          });
        }
        res.send(result);
      } catch (error) {
       
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    app.delete("/history/:id", async (req, res) => {
      const result = await historyCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Task Handler is running");
});

app.listen(port, () => {
  // console.log(`Example app listening on port ${port}`);
});
