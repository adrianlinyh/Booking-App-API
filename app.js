let express = require("express");
const cors = require("cors");
require("dotenv").config();
const { Pool } = require("pg");
const { DATABASE_URL } = process.env;

let app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    require: true,
  },
});

async function getPostgresVersion() {
  const client = await pool.connect();

  try {
    const response = await client.query("SELECT version()");
    console.log(response.rows[0]);
  } finally {
    client.release();
  }
}

getPostgresVersion();

app.get("/posts/user/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const client = await pool.connect();

  try {
    const posts = await client.query("SELECT * FROM posts WHERE user_id =$1", [
      user_id,
    ]);
    if (posts.rowCount > 0) {
      res.json(posts.rows);
    } else {
      res.status(404).json({ error: "No posts found for this user" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post("/posts", async (req, res) => {
  const { title, content, user_id } = req.body;
  const client = await pool.connect();
  try {
    // CHECK IF USER EXISTS
    const userExists = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [user_id],
    );
    if (userExists.rows.length > 0) {
      // USER EXISTS, ADD POST
      const post = await client.query(
        "INSERT INTO posts (title, content, user_id, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *",
        [title, content, user_id],
      );
      // SEND NEW POST DATA BACK TO CLIENT
      res.json(post.rows[0]);
    } else {
      // USER DOESNT EXIST
      res.status(400).json({ error: "User does not exist" });
    }
  } catch (error) {
    console.log(error.stack);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    client.release();
  }
});

app.get("/bookings/user/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const client = await pool.connect();

  try {
    const bookings = await client.query(
      "SELECT * FROM bookings WHERE user_id =$1",
      [user_id],
    );
    if (bookings.rowCount > 0) {
      res.json(bookings.rows);
    } else {
      res.status(404).json({ error: "No bookings found for this user" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete("/bookings/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("DELETE FROM bookings WHERE id = $1", [user_id]);
    res.json({ message: "Booking Deleted Successfully" });
  } catch (err) {
    console.log(err.stack);
    res.status(500).send("An error occured, please try again.");
  } finally {
    client.release();
  }
});

app.post("/bookings", async (req, res) => {
  const { user_id, post_id, date, time, duration } = req.body;
  const client = await pool.connect();

  try {
    //check if an inactive like for this user and post exists
    const prevLike = await client.query(
      `
    SELECT * FROM BOOKINGS WHERE user_id = $1 AND post_id = $2 AND active = false`,
      [user_id, post_id],
    );

    if (prevLike.rowCount > 0) {
      //if inactive like exists, update to active
      const newLike = await client.query(
        `
      UPDATE bookings SET active = true WHERE id = $1 RETURNING *`,
        [prevLike.rows[0].id],
      );
      res.json(newLike.rows[0]);
    } else {
      // if it doesnt exist, insert new like row with active as true
      const newLike = await client.query(
        `
      INSERT INTO bookings (user_id, post_id, created_at, date, time, duration, active) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, true) RETURNING *`,
        [user_id, post_id, date, time, duration],
      );
      res.json(newLike.rows[0]);
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.put("/bookings/:user_id", async (req, res) => {
  const { id, date, time, duration } = req.body;
  const { user_id } = req.params;
  const client = await pool.connect();
  
  try {
    // Check if an existing booking for this user and post exists
    const prevBooking = await client.query(
      `SELECT * FROM bookings WHERE user_id = $1 AND id = $2`, // id = bookings_id (primary key)
      [user_id, id]
    );
    console.log(user_id, id)


    if (prevBooking.rows.length > 0) {
      // If booking exists, update its date, time, and duration
      const updatedBooking = await client.query(
        `UPDATE bookings SET date = $1, time = $2, duration = $3 WHERE user_id = $4 AND id = $5 RETURNING *`,
        [date, time, duration, user_id, id]
      );
      res.json(updatedBooking.rows[0]);
    } else {
      // If booking does not exist, return an error or handle as needed
      res.status(301).json({ error: "Booking not found" });
    }
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.put("/likes/:userId/:postId", async (req, res) => {
  const { userId, postId } = req.params;
  const client = await pool.connect();

  try {
    // update the like row to inactive
    await client.query(
      `UPDATE likes SET active = false WHERE user_id = $1 AND post_id = $2 AND active = true`,
      [userId, postId],
    );
    res.json({ message: "The like has been successfully removed" });
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});


app.delete("/posts/:id", async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    const deleteQuery = "DELETE FROM posts WHERE id = $1";
    await client.query(deleteQuery, [id]);

    res.json({ status: "success", message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get("/likes/post/:post_id", async (req, res) => {
  const { post_id } = req.params;
  const client = await pool.connect();

  try {
    // FETCH ALL LIKES FOR SPECIFIC POST
    const likes = await client.query(
      `
      SELECT users.username, users.id AS user_id, likes.id AS likes_id
      FROM likes 
      INNER JOIN users ON likes.user_id = users.id
      WHERE likes.post_id = $1 AND active = true
      `,
      [post_id],
    );
    res.json(likes.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).send("An error has occured, please try again.");
  } finally {
    client.release();
  }
});

app.get("/", (req, res) => {
  res.status(200).json({ message: "Weih dont crash sia" });
});

app.get("/likes/user/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const client = await pool.connect();

  try {
    const posts = await client.query("SELECT * FROM likes WHERE user_id = $1", [
      user_id,
    ]);
    if (posts.rowCount > 0) {
      res.json(posts.rows);
    } else {
      res.status(404).json({ error: "No posts found for this user" });
    }
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});
